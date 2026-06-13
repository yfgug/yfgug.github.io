(function () {
  'use strict'

  var CONSENT_KEY = 'travel_blog_cookie_consent_v1'
  var PROFILE_KEY = 'travel_blog_profile_v1'
  var DEFAULT_PROFILE = {
    name: 'YFGUG',
    avatar: '/img/avatar.jpg'
  }
  var STALE_ARTICLE_ROUTES = {
    '/2026/06/13/thu-bdc2026-experiment-log/': 'content-20260613'
  }
  var revealObserver = null
  var progressBound = false
  var profileKeyBound = false
  var profileClickBound = false

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

  function setConsentCookie (value) {
    document.cookie = 'blog_consent=' + encodeURIComponent(value) + '; Max-Age=31536000; Path=/; SameSite=Lax'
  }

  function scrollPercent () {
    var doc = document.documentElement
    var max = Math.max(doc.scrollHeight - window.innerHeight, 1)
    return Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100)))
  }

  function initConsent () {
    if (safeGet(CONSENT_KEY)) {
      document.documentElement.classList.add('has-cookie-consent')
      return
    }
    if (document.querySelector('.cookie-consent')) return

    var panel = document.createElement('section')
    panel.className = 'cookie-consent'
    panel.setAttribute('aria-label', 'Cookie 访问授权')
    panel.innerHTML = [
      '<div class="cookie-consent__glow"></div>',
      '<div class="cookie-consent__content">',
      '  <div class="cookie-consent__eyebrow"><i class="fas fa-shield-alt"></i><span>ACCESS REQUEST</span></div>',
      '  <h2>允许本站记住你的访问偏好？</h2>',
      '  <p>只保存主题、授权状态和本地阅读体验，不写入个人身份信息。</p>',
      '  <div class="cookie-consent__actions">',
      '    <button type="button" data-consent-choice="all"><i class="fas fa-check"></i><span>同意并进入</span></button>',
      '    <button type="button" data-consent-choice="necessary"><i class="fas fa-lock"></i><span>仅必要</span></button>',
      '  </div>',
      '</div>'
    ].join('')

    panel.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent-choice]')
      if (!button) return
      var choice = button.getAttribute('data-consent-choice')
      var payload = JSON.stringify({ choice: choice, at: new Date().toISOString() })
      safeSet(CONSENT_KEY, payload)
      setConsentCookie(choice)
      document.documentElement.classList.add('has-cookie-consent')
      panel.classList.add('is-leaving')
      setTimeout(function () { panel.remove() }, 260)
    })

    document.body.appendChild(panel)
    requestAnimationFrame(function () { panel.classList.add('is-visible') })
  }

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

    document.querySelectorAll('.author-info-name').forEach(function (item) {
      item.textContent = profile.name
    })

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
      notifyProfile('\u8bf7\u9009\u62e9\u56fe\u7247\u6587\u4ef6')
      return
    }

    var reader = new FileReader()
    reader.onload = function () {
      resizeAvatarDataUrl(String(reader.result || ''), callback)
    }
    reader.onerror = function () {
      notifyProfile('\u56fe\u7247\u8bfb\u53d6\u5931\u8d25')
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
        notifyProfile('\u5df2\u6062\u590d\u9ed8\u8ba4\u8d44\u6599')
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
          notifyProfile('\u4e2a\u6027\u8d44\u6599\u5df2\u4fdd\u5b58')
        } else {
          notifyProfile('\u4fdd\u5b58\u5931\u8d25\uff0c\u53ef\u80fd\u662f\u56fe\u7247\u592a\u5927\u4e86')
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
        notifyProfile('\u5934\u50cf\u5df2\u8bfb\u53d6\uff0c\u70b9\u51fb\u4fdd\u5b58\u751f\u6548')
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
    button.setAttribute('title', '\u4fee\u6539\u5934\u50cf\u548c\u7528\u6237\u540d')
    button.innerHTML = '<i class="fas fa-user-pen"></i>' + (withText ? '<span>&#20010;&#24615;&#35774;&#32622;</span>' : '')
    button.addEventListener('click', openProfileModal)
    return button
  }

  function initProfileControls () {
    applyProfile()

    if (!profileClickBound) {
      profileClickBound = true
      document.addEventListener('click', function (event) {
        var button = event.target.closest('.profile-settings-card-btn, .profile-floating-btn')
        if (!button) return
        event.preventDefault()
        event.stopPropagation()
        openProfileModal()
      }, true)
    }

    document.querySelectorAll('.card-widget.card-info').forEach(function (card) {
      if (card.querySelector('.profile-settings-card-btn')) return

      var anchor = card.querySelector('.author-info-description') || card.querySelector('.author-info-name')
      var button = createProfileButton('profile-settings-card-btn', true)
      if (anchor && anchor.parentNode) {
        anchor.insertAdjacentElement('afterend', button)
      } else {
        card.insertBefore(button, card.firstChild)
      }
    })

    if (!document.querySelector('.profile-floating-btn')) {
      document.body.appendChild(createProfileButton('profile-floating-btn', false))
    }

    ensureProfileModal()
  }

  function initProgress () {
    var progress = document.querySelector('.trail-progress')
    if (!progress) {
      progress = document.createElement('div')
      progress.className = 'trail-progress'
      progress.innerHTML = '<div class="trail-progress__bar"></div>'
      document.body.appendChild(progress)
    }

    function update () {
      progress.style.setProperty('--trail-progress', scrollPercent() + '%')
    }

    update()
    if (!progressBound) {
      progressBound = true
      window.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
    }
  }

  function initReveal () {
    var targets = document.querySelectorAll('#recent-posts .recent-post-item, .card-widget, .article-sort-item')
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
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })

    targets.forEach(function (item, index) {
      item.style.setProperty('--reveal-delay', Math.min(index * 45, 360) + 'ms')
      revealObserver.observe(item)
    })
  }

  function initTilt () {
  }

  function isHomePage () {
    var path = window.location.pathname.replace(/\/index\.html$/, '/')
    return path === '/' || path === ''
  }

  function initHomeDock () {
    var oldDock = document.querySelector('.home-dock')
    if (oldDock) oldDock.remove()

    if (!isHomePage()) {
      return
    }

    var target = document.querySelector('#recent-posts')
    if (!target) return

    var dock = document.createElement('nav')
    dock.className = 'home-dock'
    dock.setAttribute('aria-label', '首页内容入口')
    dock.innerHTML = [
      '<a class="home-dock__item" href="/categories/%E5%BE%92%E6%AD%A5%E6%B8%B8%E8%AE%B0/">',
      '  <i class="fas fa-mountain-sun"></i>',
      '  <span><b>山野</b><small>徒步与路线</small></span>',
      '</a>',
      '<a class="home-dock__item" href="/categories/%E9%A1%B9%E7%9B%AE/">',
      '  <i class="fas fa-code"></i>',
      '  <span><b>代码</b><small>项目与工具</small></span>',
      '</a>',
      '<a class="home-dock__item" href="/categories/%E6%AF%94%E8%B5%9B%E5%A4%8D%E7%9B%98/">',
      '  <i class="fas fa-chart-line"></i>',
      '  <span><b>复盘</b><small>比赛与实验</small></span>',
      '</a>'
    ].join('')

    target.insertBefore(dock, target.firstChild)
  }

  function initSiteExperience () {
    document.documentElement.classList.add('blog-js-ready')
    initStaleArticleRescue()
    initConsent()
    initProgress()
    initHomeDock()
    initProfileControls()
    initReveal()
    initTilt()
  }

  ready(initSiteExperience)
  document.addEventListener('pjax:complete', initSiteExperience)
})()
