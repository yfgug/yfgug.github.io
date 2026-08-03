/* ============================================================
   旅行与生活 · site experience layer (Paper & Moon v4)
   ------------------------------------------------------------
   - thin reading-progress line
   - home hero: quiet entry pills + three mounted postcards
   - category hues for home cards (trail / code / gear / life)
   - Ctrl+K (or /) opens the local search
   - random-post compass in the nav
   - local profile (avatar + name, stored in this browser)
   - reveal-on-scroll, soft pjax transitions, stale-link rescue
   ============================================================ */
(function () {
  'use strict'

  var PROFILE_KEY = 'travel_blog_profile_v1'
  var DEFAULT_PROFILE = {
    name: 'YFGUG',
    avatar: '/img/avatar.jpg'
  }
  var STALE_ARTICLE_ROUTES = {
    '/2026/06/13/thu-bdc2026-experiment-log/': 'content-20260613'
  }
  var CATEGORY_BUCKETS = [
    { bucket: 'gear', match: ['装备'] },
    { bucket: 'trail', match: ['徒步', '路线', '攻略', '户外'] },
    { bucket: 'code', match: ['项目', '比赛', '复盘', '日志', '技术'] },
    { bucket: 'life', match: ['随笔', '随想', '生活', '思考'] }
  ]
  var revealObserver = null
  var progressBound = false
  var profileKeyBound = false
  var profileClickBound = false
  var softNavigationBound = false
  var searchKeyBound = false
  var postIndexPromise = null
  var inkBound = false
  var themePatched = false
  var selToolsBound = false
  var consoleEggShown = false
  var lastPointer = { x: 0, y: 0 }
  var MUSIC_LIMIT = 48
  var musicLoadPromise = null
  var musicPlayer = null

  function prefersReducedMotion () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function ready (fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true })
    } else {
      fn()
    }
  }

  function safeGet (key) {
    try { return localStorage.getItem(key) } catch (err) { return null }
  }

  function safeSet (key, value) {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (err) {
      return false
    }
  }

  function safeRemove (key) {
    try { localStorage.removeItem(key) } catch (err) {}
  }

  function normalizePath (path) {
    path = path.replace(/\/index\.html$/, '/')
    return path.endsWith('/') ? path : path + '/'
  }

  function withArticleVersion (path, version) {
    return path + '?v=' + encodeURIComponent(version)
  }

  function initStaleArticleRescue () {
    var path = normalizePath(window.location.pathname)
    var version = STALE_ARTICLE_ROUTES[path]

    if (version && !window.location.search) {
      var looksLikeCached404 = document.querySelector('.type-404, .error_title') || /^404\b/.test(document.title)
      if (looksLikeCached404) {
        window.location.replace(withArticleVersion(path, version))
        return
      }
    }

    Object.keys(STALE_ARTICLE_ROUTES).forEach(function (route) {
      var routeVersion = STALE_ARTICLE_ROUTES[route]
      var versionedHref = withArticleVersion(route, routeVersion)
      document.querySelectorAll('a[href="' + route + '"], a[href="' + window.location.origin + route + '"]').forEach(function (link) {
        link.setAttribute('href', versionedHref)
      })
    })
  }

  function scrollPercent () {
    var doc = document.documentElement
    var max = Math.max(doc.scrollHeight - window.innerHeight, 1)
    return Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100)))
  }

  function removeLegacyWidgets () {
    document.querySelectorAll('.cookie-consent, .home-dock').forEach(function (item) { item.remove() })
  }

  /* ---------- category hues for home cards ---------- */
  function categoryBucket (text) {
    text = String(text || '')
    if (!text) return ''
    for (var i = 0; i < CATEGORY_BUCKETS.length; i++) {
      var entry = CATEGORY_BUCKETS[i]
      for (var j = 0; j < entry.match.length; j++) {
        if (text.indexOf(entry.match[j]) !== -1) return entry.bucket
      }
    }
    return 'trail'
  }

  function initCategoryAccents () {
    document.querySelectorAll('#recent-posts .recent-post-item').forEach(function (card) {
      var category = card.querySelector('.article-meta__categories')
      var bucket = categoryBucket(category && category.textContent)
      if (bucket) card.setAttribute('data-cat', bucket)
    })
  }

  /* ---------- cursor glow + 3D tilt on home cards ---------- */
  function initCardGlow () {
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    document.querySelectorAll('#recent-posts .recent-post-item').forEach(function (card) {
      if (card.dataset.glowBound) return
      card.dataset.glowBound = '1'

      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect()
        var px = (event.clientX - rect.left) / Math.max(rect.width, 1)
        var py = (event.clientY - rect.top) / Math.max(rect.height, 1)

        card.style.setProperty('--glow-x', (px * 100).toFixed(2) + '%')
        card.style.setProperty('--glow-y', (py * 100).toFixed(2) + '%')
        card.style.setProperty('--tilt-x', ((0.5 - py) * 3.4).toFixed(2) + 'deg')
        card.style.setProperty('--tilt-y', ((px - 0.5) * 4.2).toFixed(2) + 'deg')
      }, { passive: true })

      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--tilt-x', '0deg')
        card.style.setProperty('--tilt-y', '0deg')
      }, { passive: true })
    })
  }

  /* ---------- Ctrl+K / '/' opens the local search ---------- */
  function isTypingContext (target) {
    if (!target) return false
    if (target.isContentEditable) return true
    var tag = (target.tagName || '').toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select'
  }

  function openSearchDialog () {
    var trigger = document.querySelector('#search-button .search')
    if (trigger) trigger.click()
  }

  function initSearchHotkey () {
    var searchPage = document.querySelector('#search-button .site-page')
    if (searchPage && !searchPage.querySelector('.search-kbd')) {
      var kbd = document.createElement('span')
      kbd.className = 'search-kbd'
      kbd.setAttribute('aria-hidden', 'true')
      kbd.textContent = 'Ctrl K'
      searchPage.appendChild(kbd)
    }

    if (searchKeyBound) return
    searchKeyBound = true

    document.addEventListener('keydown', function (event) {
      var searchOpen = document.querySelector('#local-search.is-show, .search-dialog[style*="display: block"]')

      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault()
        if (!searchOpen) openSearchDialog()
        return
      }

      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isTypingContext(event.target) || searchOpen) return
        event.preventDefault()
        openSearchDialog()
      }
    })
  }

  /* ---------- local profile ---------- */
  function cleanProfileName (value) {
    var name = String(value || '').replace(/\s+/g, ' ').trim()
    return name ? name.slice(0, 28) : DEFAULT_PROFILE.name
  }

  function cleanAvatarValue (value) {
    var avatar = String(value || '').trim()
    if (!avatar) return DEFAULT_PROFILE.avatar
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(avatar)) return avatar
    if (/^https?:\/\//i.test(avatar)) return avatar
    if (avatar.charAt(0) === '/') return avatar
    return DEFAULT_PROFILE.avatar
  }

  function normalizeProfile (profile) {
    profile = profile || {}
    return {
      name: cleanProfileName(profile.name),
      avatar: cleanAvatarValue(profile.avatar)
    }
  }

  function loadProfile () {
    var raw = safeGet(PROFILE_KEY)
    if (!raw) return normalizeProfile(DEFAULT_PROFILE)

    try {
      return normalizeProfile(JSON.parse(raw))
    } catch (err) {
      return normalizeProfile(DEFAULT_PROFILE)
    }
  }

  function storeProfile (profile) {
    return safeSet(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)))
  }

  function notifyProfile (message) {
    if (window.Snackbar && typeof window.Snackbar.show === 'function') {
      window.Snackbar.show({
        text: message,
        pos: 'top-center',
        showAction: false,
        duration: 1800
      })
    }
  }

  function syncProfileModal (profile) {
    var modal = document.querySelector('.profile-modal')
    if (!modal) return

    profile = normalizeProfile(profile || loadProfile())

    var nameInput = modal.querySelector('[data-profile-name]')
    var avatarInput = modal.querySelector('[data-profile-avatar]')
    var preview = modal.querySelector('[data-profile-preview]')
    var currentName = modal.querySelector('[data-profile-current-name]')

    if (nameInput) nameInput.value = profile.name
    if (avatarInput) avatarInput.value = profile.avatar
    if (preview) preview.src = profile.avatar
    if (currentName) currentName.textContent = profile.name
  }

  function applyProfile (profile) {
    profile = normalizeProfile(profile || loadProfile())

    document.querySelectorAll('.author-info-name, .author-info__name').forEach(function (item) {
      item.textContent = profile.name
    })

    // In the file:// preview build, root-absolute avatar paths cannot resolve —
    // only rewrite images there when the visitor saved a custom avatar.
    if (window.location.protocol === 'file:' && profile.avatar === DEFAULT_PROFILE.avatar) {
      syncProfileModal(profile)
      return
    }

    document.querySelectorAll('#sidebar-menus .avatar-img img, .card-widget.card-info .avatar-img img, img[alt="avatar"]').forEach(function (image) {
      if (!image.dataset.defaultProfileAvatar) {
        image.dataset.defaultProfileAvatar = image.getAttribute('src') || DEFAULT_PROFILE.avatar
      }
      if (image.getAttribute('src') !== profile.avatar) {
        image.setAttribute('src', profile.avatar)
      }
      image.onerror = function () {
        this.onerror = null
        this.setAttribute('src', DEFAULT_PROFILE.avatar)
      }
    })

    syncProfileModal(profile)
  }

  function closeProfileModal () {
    var modal = document.querySelector('.profile-modal')
    if (!modal) return

    modal.classList.remove('is-visible')
    modal.setAttribute('aria-hidden', 'true')
    document.documentElement.classList.remove('profile-modal-open')
  }

  function openProfileModal () {
    var modal = ensureProfileModal()
    syncProfileModal(loadProfile())
    modal.classList.add('is-visible')
    modal.setAttribute('aria-hidden', 'false')
    document.documentElement.classList.add('profile-modal-open')

    var nameInput = modal.querySelector('[data-profile-name]')
    if (nameInput) {
      setTimeout(function () { nameInput.focus() }, 80)
    }
  }

  function resizeAvatarDataUrl (dataUrl, callback) {
    var image = new Image()

    image.onload = function () {
      try {
        var canvas = document.createElement('canvas')
        var size = 512
        var side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height)
        var sourceX = ((image.naturalWidth || image.width) - side) / 2
        var sourceY = ((image.naturalHeight || image.height) - side) / 2
        var context = canvas.getContext('2d')

        canvas.width = size
        canvas.height = size
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size)

        var output = canvas.toDataURL('image/webp', 0.86)
        if (!output || output.length > 1800000) {
          output = canvas.toDataURL('image/jpeg', 0.82)
        }
        callback(output || dataUrl)
      } catch (err) {
        callback(dataUrl)
      }
    }

    image.onerror = function () { callback(dataUrl) }
    image.src = dataUrl
  }

  function readAvatarFile (file, callback) {
    if (!file || !/^image\//i.test(file.type || '')) {
      notifyProfile('请选择图片文件')
      return
    }

    var reader = new FileReader()
    reader.onload = function () {
      resizeAvatarDataUrl(String(reader.result || ''), callback)
    }
    reader.onerror = function () {
      notifyProfile('图片读取失败')
    }
    reader.readAsDataURL(file)
  }

  function ensureProfileModal () {
    var modal = document.querySelector('.profile-modal')
    if (modal) return modal

    modal = document.createElement('div')
    modal.className = 'profile-modal'
    modal.setAttribute('aria-hidden', 'true')
    modal.innerHTML = [
      '<div class="profile-modal__backdrop" data-profile-close></div>',
      '<section class="profile-modal__panel" role="dialog" aria-modal="true" aria-label="Profile settings">',
      '  <div class="profile-modal__shine"></div>',
      '  <button class="profile-modal__close" type="button" data-profile-close aria-label="Close"><i class="fas fa-xmark"></i></button>',
      '  <div class="profile-modal__header">',
      '    <img class="profile-modal__avatar" data-profile-preview src="' + DEFAULT_PROFILE.avatar + '" alt="avatar preview">',
      '    <div class="profile-modal__title">',
      '      <div class="profile-modal__eyebrow">LOCAL PROFILE</div>',
      '      <h2>&#20010;&#24615;&#36164;&#26009;</h2>',
      '      <p>&#22836;&#20687;&#21644;&#29992;&#25143;&#21517;&#20250;&#20445;&#23384;&#22312;&#24403;&#21069;&#27983;&#35272;&#22120;&#12290;</p>',
      '    </div>',
      '  </div>',
      '  <div class="profile-modal__body">',
      '    <label class="profile-modal__field">',
      '      <span>&#29992;&#25143;&#21517;&#31216;</span>',
      '      <input type="text" maxlength="28" autocomplete="off" data-profile-name placeholder="YFGUG">',
      '    </label>',
      '    <label class="profile-modal__field">',
      '      <span>&#22836;&#20687;&#38142;&#25509;</span>',
      '      <input type="url" data-profile-avatar placeholder="/img/avatar.jpg">',
      '    </label>',
      '    <label class="profile-modal__file">',
      '      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-profile-file>',
      '      <i class="fas fa-image"></i>',
      '      <span>&#36873;&#25321;&#26412;&#22320;&#22836;&#20687;</span>',
      '    </label>',
      '    <div class="profile-modal__hint">&#26412;&#22320;&#22270;&#29255;&#20250;&#33258;&#21160;&#35009;&#20999;&#24182;&#21387;&#32553;&#65292;&#19981;&#20250;&#19978;&#20256;&#21040;&#26381;&#21153;&#22120;&#12290;</div>',
      '  </div>',
      '  <div class="profile-modal__actions">',
      '    <button type="button" class="profile-modal__button profile-modal__button--ghost" data-profile-action="reset">&#24674;&#22797;&#40664;&#35748;</button>',
      '    <button type="button" class="profile-modal__button" data-profile-close>&#21462;&#28040;</button>',
      '    <button type="button" class="profile-modal__button profile-modal__button--primary" data-profile-action="save">&#20445;&#23384;</button>',
      '  </div>',
      '</section>'
    ].join('')

    modal.addEventListener('click', function (event) {
      if (event.target.closest('[data-profile-close]')) {
        closeProfileModal()
        return
      }

      var action = event.target.closest('[data-profile-action]')
      if (!action) return

      if (action.getAttribute('data-profile-action') === 'reset') {
        safeRemove(PROFILE_KEY)
        applyProfile(DEFAULT_PROFILE)
        syncProfileModal(DEFAULT_PROFILE)
        notifyProfile('已恢复默认资料')
        return
      }

      if (action.getAttribute('data-profile-action') === 'save') {
        var nextProfile = normalizeProfile({
          name: modal.querySelector('[data-profile-name]').value,
          avatar: modal.querySelector('[data-profile-avatar]').value
        })

        if (storeProfile(nextProfile)) {
          applyProfile(nextProfile)
          closeProfileModal()
          notifyProfile('个性资料已保存')
        } else {
          notifyProfile('保存失败，可能是图片太大了')
        }
      }
    })

    modal.querySelector('[data-profile-avatar]').addEventListener('input', function () {
      var preview = modal.querySelector('[data-profile-preview]')
      if (preview) preview.src = cleanAvatarValue(this.value)
    })

    modal.querySelector('[data-profile-name]').addEventListener('input', function () {
      var currentName = modal.querySelector('[data-profile-current-name]')
      if (currentName) currentName.textContent = cleanProfileName(this.value)
    })

    modal.querySelector('[data-profile-file]').addEventListener('change', function () {
      var file = this.files && this.files[0]
      readAvatarFile(file, function (avatar) {
        var avatarInput = modal.querySelector('[data-profile-avatar]')
        var preview = modal.querySelector('[data-profile-preview]')
        if (avatarInput) avatarInput.value = avatar
        if (preview) preview.src = avatar
        notifyProfile('头像已读取，点击保存生效')
      })
    })

    if (!profileKeyBound) {
      profileKeyBound = true
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeProfileModal()
      })
    }

    document.body.appendChild(modal)
    return modal
  }

  function createProfileButton (className, withText) {
    var button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.setAttribute('title', '修改头像和用户名')
    button.setAttribute('aria-label', '修改头像和用户名')
    button.innerHTML = '<i class="fas fa-user-pen"></i>' + (withText ? '<span>&#20010;&#24615;&#35774;&#32622;</span>' : '')
    button.addEventListener('click', openProfileModal)
    return button
  }

  function initProfileControls () {
    applyProfile()

    if (!profileClickBound) {
      profileClickBound = true
      document.addEventListener('click', function (event) {
        var button = event.target.closest('.profile-settings-card-btn, .rightside-profile-btn')
        if (!button) return
        event.preventDefault()
        event.stopPropagation()
        openProfileModal()
      }, true)
    }

    document.querySelectorAll('.card-widget.card-info').forEach(function (card) {
      if (card.querySelector('.profile-settings-card-btn')) return

      var anchor = card.querySelector('.author-info-description') || card.querySelector('.author-info__description') || card.querySelector('.author-info-name') || card.querySelector('.author-info__name')
      var button = createProfileButton('profile-settings-card-btn', true)
      if (anchor && anchor.parentNode) {
        anchor.insertAdjacentElement('afterend', button)
      } else {
        card.insertBefore(button, card.firstChild)
      }
    })

    var staleFloating = document.querySelector('.profile-floating-btn')
    if (staleFloating) staleFloating.remove()

    var rightsideShow = document.querySelector('#rightside #rightside-config-show')
    if (rightsideShow && !rightsideShow.querySelector('.rightside-profile-btn')) {
      rightsideShow.insertBefore(createProfileButton('rightside-profile-btn', false), rightsideShow.firstChild)
    }

    ensureProfileModal()
  }

  /* ---------- thin reading-progress line ---------- */
  function initProgress () {
    var progress = document.querySelector('.trail-progress')
    if (!progress) {
      progress = document.createElement('div')
      progress.className = 'trail-progress'
      progress.setAttribute('role', 'progressbar')
      progress.setAttribute('aria-label', '阅读进度')
      progress.setAttribute('aria-valuemin', '0')
      progress.setAttribute('aria-valuemax', '100')
      document.body.appendChild(progress)
    } else if (progress.firstChild) {
      progress.innerHTML = ''
    }

    function update () {
      var percent = scrollPercent()
      progress.style.setProperty('--trail-progress', percent + '%')
      progress.setAttribute('aria-valuenow', String(percent))
      progress.classList.toggle('is-active', percent > 1)
      progress.classList.toggle('is-complete', percent >= 99)
      document.documentElement.classList.toggle('cl-scrolled', window.scrollY > 60)
    }

    update()
    if (!progressBound) {
      progressBound = true
      window.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
    }
  }

  /* ---------- reveal on scroll ---------- */
  function initReveal () {
    var targets = document.querySelectorAll('#recent-posts .recent-post-item, .card-widget:not(#card-toc), .article-sort-item')
    if (revealObserver) revealObserver.disconnect()

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (item) { item.classList.add('is-visible') })
      return
    }

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' })

    targets.forEach(function (item, index) {
      item.style.setProperty('--reveal-delay', Math.min(index * 25, 125) + 'ms')
      revealObserver.observe(item)
    })
  }

  /* ---------- home hero ---------- */
  function isHomePage () {
    var path = window.location.pathname.replace(/\/index\.html$/, '/')
    return path === '/' || path === ''
  }

  function removeExploreHero () {
    document.documentElement.classList.remove('explore-home')
    document.querySelectorAll('.explore-hero-scene, .explore-hero-links, .explore-hero-ridge, .hero-ambience, .hero-lower, .hero-pills, .hero-geo').forEach(function (item) {
      item.remove()
    })
  }

  function createHeroPills () {
    var pills = document.createElement('nav')
    pills.className = 'hero-pills'
    pills.setAttribute('aria-label', '快速入口')
    pills.innerHTML = [
      '<a class="hero-pill" href="/categories/%E5%BE%92%E6%AD%A5%E6%B8%B8%E8%AE%B0/">&#24466;&#27493;&#28216;&#35760;<span class="hero-pill-arrow" aria-hidden="true">&#8594;</span></a>',
      '<a class="hero-pill" href="/categories/%E9%A1%B9%E7%9B%AE/">&#39033;&#30446;&#26723;&#26696;<span class="hero-pill-arrow" aria-hidden="true">&#8594;</span></a>',
      '<a class="hero-pill" href="/categories/%E6%AF%94%E8%B5%9B%E5%A4%8D%E7%9B%98/">&#27604;&#36187;&#22797;&#30424;<span class="hero-pill-arrow" aria-hidden="true">&#8594;</span></a>'
    ].join('')

    return pills
  }

  function createHeroGeo () {
    var geo = document.createElement('div')
    geo.className = 'hero-geo'
    geo.setAttribute('aria-hidden', 'true')
    geo.innerHTML = '<span class="hero-geo__peak">&#9650;</span> WUGONGSHAN &#27494;&#21151;&#23665; &#183; 27.46&#176;N 114.16&#176;E &#183; ALT 1918M'
    return geo
  }

  function initExploreHero () {
    if (!isHomePage()) {
      removeExploreHero()
      return
    }

    var header = document.querySelector('#page-header.full_page')
    if (!header) return

    document.documentElement.classList.add('explore-home')

    var staleLower = header.querySelector('.hero-lower')
    if (staleLower) staleLower.remove()

    var siteInfo = header.querySelector('#site-info')
    if (siteInfo && !siteInfo.querySelector('.hero-pills')) {
      siteInfo.appendChild(createHeroPills())
    }

    if (!header.querySelector('.hero-geo')) {
      header.appendChild(createHeroGeo())
    }
  }

  /* ---------- random post compass ---------- */
  function loadPostIndex () {
    if (postIndexPromise) return postIndexPromise

    postIndexPromise = window.fetch('/search.xml', { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('Search index unavailable')
        return response.text()
      })
      .then(function (text) {
        var xml = new window.DOMParser().parseFromString(text, 'application/xml')
        return Array.from(xml.querySelectorAll('entry url'))
          .map(function (item) { return item.textContent.trim() })
          .filter(function (url) { return /^\/\d{4}\/\d{2}\/\d{2}\//.test(url) })
      })
      .catch(function (error) {
        postIndexPromise = null
        throw error
      })

    return postIndexPromise
  }

  function initRandomPost () {
    var nav = document.querySelector('#nav')
    var searchButton = document.querySelector('#search-button')
    if (!nav || !searchButton || document.querySelector('.random-post-nav')) return

    var button = document.createElement('button')
    button.type = 'button'
    button.className = 'random-post-nav'
    button.setAttribute('title', '随机出发')
    button.setAttribute('aria-label', '随机出发')
    button.innerHTML = '<i class="fas fa-compass"></i>'

    button.addEventListener('click', function () {
      if (button.disabled) return
      button.disabled = true
      button.classList.add('is-spinning')

      loadPostIndex()
        .then(function (posts) {
          var current = normalizePath(window.location.pathname)
          var candidates = posts.filter(function (url) { return normalizePath(url) !== current })
          if (!candidates.length) throw new Error('No random post available')

          var target = candidates[Math.floor(Math.random() * candidates.length)]
          window.setTimeout(function () { window.location.assign(target) }, 620)
        })
        .catch(function () {
          button.disabled = false
          button.classList.remove('is-spinning')
        })
    })

    searchButton.parentNode.insertBefore(button, searchButton)
  }

  /* ---------- soft pjax transitions ---------- */
  function initSoftNavigation () {
    if (softNavigationBound) return
    softNavigationBound = true

    document.addEventListener('pjax:send', function () {
      document.documentElement.classList.remove('soft-nav-entering')
      document.documentElement.classList.add('soft-nav-leaving')
    })

    document.addEventListener('pjax:complete', function () {
      document.documentElement.classList.remove('soft-nav-leaving')
      document.documentElement.classList.add('soft-nav-entering')
      window.setTimeout(function () {
        document.documentElement.classList.remove('soft-nav-entering')
      }, 340)
    })
  }

  /* ---------- ink ripple on click ---------- */
  function initInkRipple () {
    if (inkBound) return
    inkBound = true

    document.addEventListener('pointerdown', function (event) {
      lastPointer.x = event.clientX
      lastPointer.y = event.clientY

      if (prefersReducedMotion()) return
      if (event.button !== 0) return
      if (event.target.closest('.aplayer, .profile-modal, #local-search, .leaflet-container')) return

      var ink = document.createElement('span')
      ink.className = 'cl-ink'
      ink.style.left = event.clientX + 'px'
      ink.style.top = event.clientY + 'px'
      document.body.appendChild(ink)
      ink.addEventListener('animationend', function () { ink.remove() })
      window.setTimeout(function () { ink.remove() }, 900)
    }, { passive: true })
  }

  /* ---------- dark mode switch: circular reveal (View Transitions) ---------- */
  function patchThemeFn (name) {
    var original = window.btf[name]
    if (typeof original !== 'function') return

    window.btf[name] = function () {
      var args = arguments
      var self = this

      if (prefersReducedMotion() || !document.startViewTransition || document.documentElement.dataset.themeTransition) {
        return original.apply(self, args)
      }

      var x = lastPointer.x || window.innerWidth - 40
      var y = lastPointer.y || window.innerHeight - 140
      var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

      document.documentElement.dataset.themeTransition = '1'
      var transition = document.startViewTransition(function () {
        original.apply(self, args)
      })

      transition.ready.then(function () {
        document.documentElement.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        )
      }).catch(function () {})

      transition.finished.finally(function () {
        delete document.documentElement.dataset.themeTransition
      })
    }
  }

  function initThemeRipple () {
    if (themePatched) return
    if (typeof window.btf === 'undefined' || !window.btf.activateDarkMode) return
    themePatched = true
    patchThemeFn('activateDarkMode')
    patchThemeFn('activateLightMode')
  }

  /* ---------- selection toolbar: copy / share ---------- */
  function hideSelTools () {
    var tools = document.querySelector('.sel-tools')
    if (tools) tools.classList.remove('is-visible')
  }

  function ensureSelTools () {
    var tools = document.querySelector('.sel-tools')
    if (tools) return tools

    tools = document.createElement('div')
    tools.className = 'sel-tools'
    tools.innerHTML = [
      '<button type="button" data-sel-action="copy"><i class="fas fa-copy"></i> &#22797;&#21046;</button>',
      '<button type="button" data-sel-action="weibo"><i class="fab fa-weibo"></i> &#20998;&#20139;</button>'
    ].join('')

    tools.addEventListener('pointerdown', function (event) {
      event.preventDefault()
      event.stopPropagation()

      var button = event.target.closest('[data-sel-action]')
      if (!button) return

      var text = String(window.getSelection())
      if (!text) { hideSelTools(); return }

      if (button.getAttribute('data-sel-action') === 'copy') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            notifyProfile('已复制选中内容')
          }).catch(function () {})
        }
      } else {
        window.open(
          'https://service.weibo.com/share/share.php?url=' + encodeURIComponent(window.location.href) +
          '&title=' + encodeURIComponent('「' + text.slice(0, 100) + '」— ' + document.title),
          '_blank',
          'noopener,width=660,height=520'
        )
      }

      hideSelTools()
    })

    document.body.appendChild(tools)
    return tools
  }

  function initSelectionTools () {
    if (selToolsBound) return
    selToolsBound = true

    document.addEventListener('mouseup', function (event) {
      if (event.target.closest('.sel-tools')) return

      window.setTimeout(function () {
        var selection = window.getSelection()
        var text = selection ? String(selection).trim() : ''
        var anchor = selection && selection.anchorNode && selection.anchorNode.parentElement

        if (!text || text.length < 2 || !anchor || !anchor.closest('#article-container, #post-content')) {
          hideSelTools()
          return
        }

        var range = selection.getRangeAt(0).getBoundingClientRect()
        if (!range || (!range.width && !range.height)) { hideSelTools(); return }

        var tools = ensureSelTools()
        tools.classList.add('is-visible')

        var width = tools.offsetWidth || 150
        var left = Math.min(Math.max(range.left + (range.width / 2) - (width / 2), 12), window.innerWidth - width - 12)
        tools.style.left = left + 'px'
        tools.style.top = Math.max(range.top - 46, 12) + 'px'
      }, 0)
    })

    document.addEventListener('scroll', hideSelTools, { passive: true })
    document.addEventListener('selectionchange', function () {
      var selection = window.getSelection()
      if (!selection || !String(selection).trim()) hideSelTools()
    })
  }

  /* ---------- on-demand music player ---------- */
  function loadMusicStylesheet (href) {
    if (!href) return Promise.reject(new Error('Missing APlayer stylesheet'))

    var existing = document.querySelector('link[data-music-asset="style"]')
    if (existing && existing.sheet) return Promise.resolve()

    return new Promise(function (resolve, reject) {
      var link = existing || document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.dataset.musicAsset = 'style'
      link.onload = function () { resolve() }
      link.onerror = function () {
        link.remove()
        reject(new Error('APlayer stylesheet failed to load'))
      }
      if (!existing) document.head.appendChild(link)
    })
  }

  function loadMusicScript (src) {
    if (window.APlayer) return Promise.resolve()
    if (!src) return Promise.reject(new Error('Missing APlayer script'))

    var existing = document.querySelector('script[data-music-asset="script"]')
    return new Promise(function (resolve, reject) {
      var script = existing || document.createElement('script')
      script.src = src
      script.dataset.musicAsset = 'script'
      script.onload = function () {
        if (window.APlayer) resolve()
        else reject(new Error('APlayer is unavailable'))
      }
      script.onerror = function () {
        script.remove()
        reject(new Error('APlayer script failed to load'))
      }
      if (!existing) document.head.appendChild(script)
    })
  }

  function sampleMusicTracks (items) {
    var tracks = (Array.isArray(items) ? items : [])
      .filter(function (item) { return item && item.name && item.url })
      .map(function (item) {
        return {
          name: String(item.name),
          artist: String(item.artist || '未知音乐人'),
          url: String(item.url),
          cover: String(item.pic || '/img/avatar.jpg')
        }
      })

    for (var i = tracks.length - 1; i > 0; i--) {
      var swapIndex = Math.floor(Math.random() * (i + 1))
      var current = tracks[i]
      tracks[i] = tracks[swapIndex]
      tracks[swapIndex] = current
    }

    return tracks.slice(0, MUSIC_LIMIT)
  }

  function fetchMusicTracks (api) {
    if (!api) return Promise.reject(new Error('Missing playlist API'))

    return window.fetch(api + encodeURIComponent(Date.now()), {
      cache: 'no-store',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) throw new Error('Playlist request failed')
      return response.json()
    }).then(function (items) {
      var tracks = sampleMusicTracks(items)
      if (!tracks.length) throw new Error('Playlist is empty')
      return tracks
    })
  }

  function labelMusicControls (root) {
    if (!root) return

    var labels = {
      '.aplayer-icon-play': '播放或暂停',
      '.aplayer-icon-pause': '播放或暂停',
      '.aplayer-icon-back': '上一首',
      '.aplayer-icon-forward': '下一首',
      '.aplayer-icon-menu': '展开或收起播放列表',
      '.aplayer-icon-lrc': '显示或隐藏歌词',
      '.aplayer-icon-order': '切换播放顺序',
      '.aplayer-icon-loop': '切换循环模式',
      '.aplayer-icon-volume-down': '静音',
      '.aplayer-icon-volume-up': '调整音量',
      '.aplayer-miniswitcher .aplayer-icon': '切换迷你播放器'
    }

    Object.keys(labels).forEach(function (selector) {
      root.querySelectorAll(selector).forEach(function (control) {
        control.setAttribute('aria-label', labels[selector])
        if (!control.getAttribute('title')) control.setAttribute('title', labels[selector])
        if (control.tagName !== 'BUTTON') {
          control.setAttribute('role', 'button')
          control.setAttribute('tabindex', '0')
          if (!control.dataset.musicKeyBound) {
            control.dataset.musicKeyBound = '1'
            control.addEventListener('keydown', function (event) {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              control.click()
            })
          }
        }
      })
    })

    root.querySelectorAll('button:not([aria-label])').forEach(function (button) {
      button.setAttribute('aria-label', button.getAttribute('title') || '音乐播放器控制')
    })
  }

  function setMusicOpen (shell, open) {
    var trigger = shell.querySelector('.cl-music__trigger')
    var panel = shell.querySelector('.cl-music__panel')
    shell.classList.toggle('is-open', open)
    trigger.setAttribute('aria-expanded', String(open))
    trigger.setAttribute('aria-label', open ? '收起音乐播放器' : '打开音乐播放器')
    trigger.setAttribute('title', open ? '收起音乐播放器' : '打开音乐播放器')
    panel.setAttribute('aria-hidden', String(!open))
  }

  function setMusicStatus (shell, message, state) {
    var status = shell.querySelector('[data-music-status]')
    shell.classList.remove('is-loading', 'has-error', 'is-ready')
    if (state) shell.classList.add(state)
    status.hidden = !message
    status.textContent = message || ''
  }

  function startMusicLoad (shell) {
    var host = shell.querySelector('[data-music-player]')
    var trigger = shell.querySelector('.cl-music__trigger')
    host.innerHTML = ''
    setMusicStatus(shell, '正在接入歌单…', 'is-loading')
    trigger.setAttribute('aria-label', '正在载入音乐播放器')
    trigger.setAttribute('title', '正在载入音乐播放器')

    musicLoadPromise = Promise.all([
      loadMusicStylesheet(shell.dataset.aplayerCss),
      loadMusicScript(shell.dataset.aplayerJs),
      fetchMusicTracks(shell.dataset.musicApi)
    ]).then(function (result) {
      musicPlayer = new window.APlayer({
        container: host,
        autoplay: false,
        fixed: false,
        mini: false,
        mutex: true,
        theme: '#C15F3C',
        loop: 'all',
        order: 'random',
        preload: 'none',
        volume: 0.55,
        listFolded: true,
        listMaxHeight: '220px',
        storageName: 'travel_blog_music',
        audio: result[2]
      })

      setMusicStatus(shell, '', 'is-ready')
      setMusicOpen(shell, true)
      labelMusicControls(host)

      var observer = new MutationObserver(function () { labelMusicControls(host) })
      observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    }).catch(function () {
      musicLoadPromise = null
      setMusicStatus(shell, '歌单暂时没有接上，点耳机再试一次。', 'has-error')
      trigger.setAttribute('aria-label', '重试载入音乐播放器')
      trigger.setAttribute('title', '重试载入音乐播放器')
    })
  }

  function toggleMusic (shell) {
    if (musicPlayer || musicLoadPromise) {
      setMusicOpen(shell, !shell.classList.contains('is-open'))
      return
    }

    setMusicOpen(shell, true)
    startMusicLoad(shell)
  }

  function initMobileMusicNav (shell) {
    var menus = document.querySelector('#nav #menus')
    var toggleMenu = menus && menus.querySelector('#toggle-menu')
    if (!menus || menus.querySelector('.mobile-music-nav-btn')) return

    var button = document.createElement('button')
    button.type = 'button'
    button.className = 'site-page mobile-music-nav-btn'
    button.setAttribute('title', '打开音乐播放器')
    button.setAttribute('aria-label', '打开音乐播放器')
    button.setAttribute('aria-controls', 'cl-music-panel')
    button.innerHTML = '<i class="fas fa-headphones" aria-hidden="true"></i>'
    button.addEventListener('click', function () { toggleMusic(shell) })

    menus.insertBefore(button, toggleMenu || null)
  }

  function initMusicLauncher () {
    var shell = document.querySelector('[data-music-shell]')
    if (!shell) return

    initMobileMusicNav(shell)
    if (musicPlayer) labelMusicControls(shell.querySelector('[data-music-player]'))
    if (shell.dataset.musicBound) return
    shell.dataset.musicBound = '1'

    var trigger = shell.querySelector('.cl-music__trigger')
    trigger.addEventListener('click', function () { toggleMusic(shell) })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && shell.classList.contains('is-open')) {
        setMusicOpen(shell, false)
        trigger.focus()
      }
    })
  }

  /* ---------- console egg ---------- */
  function showConsoleEgg () {
    if (consoleEggShown) return
    consoleEggShown = true

    try {
      console.log(
        '%c\n      /\\\n     /  \\   /\\\n    /    \\ /  \\\n   /      X    \\\n  /      / \\    \\\n /______/___\\____\\_____\n%c  旅行与生活 · 山就在那里\n%c  https://luanjiahao.qzz.io\n',
        'color:#3E6B54;font-family:monospace;font-size:12px;',
        'color:#C15F3C;font-weight:bold;font-size:13px;',
        'color:#9B968B;font-size:11px;'
      )
    } catch (err) {}
  }

  /* ---------- boot ---------- */
  function initSiteExperience () {
    document.documentElement.classList.add('blog-js-ready')
    removeLegacyWidgets()
    initSoftNavigation()
    initStaleArticleRescue()
    initProgress()
    initExploreHero()
    initCategoryAccents()
    initCardGlow()
    initInkRipple()
    initThemeRipple()
    initSelectionTools()
    initMusicLauncher()
    showConsoleEgg()
    initSearchHotkey()
    initRandomPost()
    initProfileControls()
    initReveal()
  }

  ready(initSiteExperience)
  document.addEventListener('pjax:complete', initSiteExperience)
})()
