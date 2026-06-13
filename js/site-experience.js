(function () {
  'use strict'

  var CONSENT_KEY = 'travel_blog_cookie_consent_v1'
  var STALE_ARTICLE_ROUTES = {
    '/2026/06/13/thu-bdc2026-experiment-log/': 'content-20260613'
  }
  var revealObserver = null
  var progressBound = false

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
    try { localStorage.setItem(key, value) } catch (err) {}
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
    initReveal()
    initTilt()
  }

  ready(initSiteExperience)
  document.addEventListener('pjax:complete', initSiteExperience)
})()
