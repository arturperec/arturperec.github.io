const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// The words the script writes into the page, in the page's language (/pl/ is the Polish page)
const say = document.documentElement.lang === 'pl' ? {
  play: 'Odtwórz', pause: 'Pauza', soundOff: 'Dźwięk wył.', soundOn: 'Dźwięk wł.', of: 'z',
  sending: 'Wysyłanie…',
  sent: 'Dzięki, wiadomość jest w drodze. Wkrótce odpiszę e-mailem.',
  failed: 'Nie udało się wysłać. Spróbuj jeszcze raz albo napisz na artur.g.perec@gmail.com.',
} : {
  play: 'Play', pause: 'Pause', soundOff: 'Sound off', soundOn: 'Sound on', of: 'of',
  sending: 'Sending…',
  sent: 'Thanks, your message is on its way. I’ll reply by email soon.',
  failed: 'That didn’t go through. Please try again, or email me at artur.g.perec@gmail.com.',
}

// Hero: the products crossfade, one every six seconds, with the bar naming the one on screen.
// The arrows, the squares and a swipe move by hand and restart the six seconds.
const slides = [...document.querySelectorAll('.slide')]
const stage = document.querySelector('.hero-stage')
const barName = document.querySelector('.hero-bar-name')
const barKind = document.querySelector('.hero-bar-kind')
const dots = [...document.querySelectorAll('.hero-dots button')]
let current = 0
let timer = null

function showSlide(index) {
  slides[current].classList.remove('is-active')
  slides[current].setAttribute('aria-hidden', 'true')
  current = index
  const slide = slides[current]
  slide.classList.add('is-active')
  slide.removeAttribute('aria-hidden')
  barName.textContent = slide.dataset.name
  barName.href = `#${slide.dataset.target}`
  barKind.textContent = slide.dataset.kind
  dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)))
  stage.style.setProperty('--stage-ink', slide.style.getPropertyValue('--slide-ink'))
}

// The first slide's picture comes with the page; the other three wait for the page to load, or for the visitor
function whenLoaded(run) {
  if (document.readyState === 'complete') run()
  else addEventListener('load', run, { once: true })
}

function wakeSlides() {
  document.querySelectorAll('.slide img[data-src]').forEach(img => {
    img.srcset = img.dataset.srcset
    img.src = img.dataset.src
    img.removeAttribute('data-srcset')
    img.removeAttribute('data-src')
  })
}

whenLoaded(wakeSlides)

function goTo(index) {
  wakeSlides()
  showSlide((index + slides.length) % slides.length)
  stopSlides()
  startSlides()
}

// The slideshow starts turning once the visitor is there: the first move, scroll, touch or key.
// Until then the first screen stays still, so it is finished the moment it has painted.
let slidesArmed = false

function startSlides() {
  if (reduceMotion || paused || timer || !slidesArmed) return
  timer = setInterval(() => showSlide((current + 1) % slides.length), 6000)
}

function stopSlides() {
  clearInterval(timer)
  timer = null
}

const pauseButton = document.querySelector('.hero-pause')
let paused = false

pauseButton.addEventListener('click', () => {
  paused = !paused
  pauseButton.setAttribute('aria-pressed', String(paused))
  pauseButton.textContent = paused ? say.play : say.pause
  paused ? stopSlides() : startSlides()
})

dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)))
document.querySelectorAll('.hero-stage [data-step]').forEach(arrow => {
  arrow.addEventListener('click', () => goTo(current + Number(arrow.dataset.step)))
})

// Swipe: the slide follows the finger with the next one beside it, and letting go snaps to the nearer one.
// A flick counts too. Up-and-down drags are left to the page's scroll.
let drag = null

function holdSlide(slide, x) {
  slide.style.transition = 'none'
  slide.style.visibility = 'visible'
  slide.style.opacity = '1'
  slide.style.transform = `translateX(${x}px)`
}

function releaseSlide(slide) {
  // Back to what the classes say, without the crossfade noticing: a slide that is not showing hides before it moves home
  slide.style.transition = 'none'
  if (!slide.classList.contains('is-active')) {
    slide.style.opacity = '0'
    slide.style.visibility = 'hidden'
  }
  slide.style.transform = ''
  getComputedStyle(slide).opacity // apply that now, so dropping the inline styles below changes nothing to animate
  requestAnimationFrame(() => slide.removeAttribute('style'))
}

stage.addEventListener('touchstart', event => {
  wakeSlides()
  if (event.touches.length !== 1 || drag?.settling) return
  drag = { x: event.touches[0].clientX, y: event.touches[0].clientY, dx: 0, t: performance.now(), axis: null, step: 0, side: null }
}, { passive: true })

stage.addEventListener('touchmove', event => {
  if (!drag || drag.settling) return
  const dx = event.touches[0].clientX - drag.x
  const dy = event.touches[0].clientY - drag.y
  if (!drag.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (drag.axis === 'x') stopSlides()
  }
  if (drag.axis !== 'x') return
  const width = stage.offsetWidth
  const step = dx < 0 ? 1 : -1
  if (step !== drag.step) {
    if (drag.side) releaseSlide(drag.side)
    drag.step = step
    drag.side = slides[(current + step + slides.length) % slides.length]
  }
  drag.dx = dx
  drag.t2 = performance.now()
  holdSlide(slides[current], dx)
  holdSlide(drag.side, dx + step * width)
}, { passive: true })

function endDrag() {
  if (!drag || drag.settling) return
  if (drag.axis !== 'x' || !drag.side) { drag = null; return }
  const width = stage.offsetWidth
  const speed = Math.abs(drag.dx) / Math.max(1, (drag.t2 || performance.now()) - drag.t)
  const turn = Math.abs(drag.dx) > width * 0.25 || (speed > 0.5 && Math.abs(drag.dx) > 24)
  const from = slides[current]
  const side = drag.side
  const step = drag.step
  const ease = reduceMotion ? 'none' : 'transform .45s cubic-bezier(.2, .7, .2, 1)'
  drag.settling = true
  from.style.transition = side.style.transition = ease
  from.style.transform = `translateX(${turn ? -step * width : 0}px)`
  side.style.transform = `translateX(${turn ? 0 : step * width}px)`
  const settle = () => {
    // The new slide is already in place, so the classes change with nothing left to fade
    if (turn) showSlide((current + step + slides.length) % slides.length)
    releaseSlide(from)
    releaseSlide(side)
    drag = null
    startSlides()
  }
  if (reduceMotion) settle()
  else setTimeout(settle, 460)
}

stage.addEventListener('touchend', endDrag)
stage.addEventListener('touchcancel', endDrag)

// The bar's project name jumps to that project; a button then offers the way back
const backTop = document.querySelector('.back-top')

function hideBackTop() {
  backTop.classList.remove('is-shown')
  setTimeout(() => { if (!backTop.classList.contains('is-shown')) backTop.hidden = true }, 300)
}

barName.addEventListener('click', () => {
  backTop.hidden = false
  requestAnimationFrame(() => backTop.classList.add('is-shown'))
})

backTop.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  history.replaceState(null, '', location.pathname)
  hideBackTop()
  barName.focus({ preventScroll: true })
})

new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting && backTop.classList.contains('is-shown')) hideBackTop()
}, { threshold: 0.6 }).observe(stage)

document.addEventListener('visibilitychange', () => (document.hidden ? stopSlides() : startSlides()))
const firstSigns = ['pointermove', 'pointerdown', 'wheel', 'scroll', 'keydown', 'touchstart']
function armSlides() {
  firstSigns.forEach(type => removeEventListener(type, armSlides, true))
  slidesArmed = true
  wakeSlides()
  startSlides()
}
firstSigns.forEach(type => addEventListener(type, armSlides, { capture: true, passive: true }))
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-ready')))

// Site bar: it slides in once the hero (which has its own nav) is behind, and marks the project being read
const siteBar = document.querySelector('.site-bar')
const siteMenu = siteBar.querySelector('.site-bar-menu')

// It reads where the hero really is rather than trusting the observer's entry, which can be stale during a reload
const hero = document.querySelector('.hero')
new IntersectionObserver(() => {
  const past = hero.getBoundingClientRect().bottom <= siteBar.offsetHeight
  siteBar.classList.toggle('is-shown', past)
  if (!past) siteMenu.open = false
}, { rootMargin: `-${siteBar.offsetHeight}px 0px 0px 0px`, threshold: [0, .05, .1] }).observe(hero)

const watchProject = new IntersectionObserver(entries => entries.forEach(entry => {
  siteBar.querySelectorAll(`a[href="#${entry.target.id}"]`).forEach(link =>
    entry.isIntersecting ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'))
}), { rootMargin: '-45% 0px -54% 0px' })
document.querySelectorAll('.project').forEach(project => watchProject.observe(project))

// The phone menu closes once a project is picked, or with Escape
siteMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { siteMenu.open = false }))
siteMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !siteMenu.open) return
  siteMenu.open = false
  siteMenu.querySelector('summary').focus()
})

// Work: the 49 video plays only while it is on screen, and the visitor can pause it or turn the sound on
const video = document.querySelector('.project-video video')
const videoToggle = document.querySelector('.video-toggle')
const videoSound = document.querySelector('.video-sound')
let videoPaused = reduceMotion
let videoVisible = false

// Phones get the vertical cut, so they get its poster too; only the one this screen needs is fetched
const phoneScreen = matchMedia('(max-width: 899px)').matches
video.poster = phoneScreen ? video.dataset.posterPhone : video.dataset.poster

function syncVideo() {
  if (videoVisible && !videoPaused) {
    video.preload = 'auto'
    video.play().catch(() => {})
  } else {
    video.pause()
  }
  videoToggle.textContent = videoPaused ? say.play : say.pause
  videoToggle.setAttribute('aria-pressed', String(videoPaused))
}

videoToggle.addEventListener('click', () => {
  videoPaused = !videoPaused
  syncVideo()
})

// Browsers only allow sound after a tap, so the video starts muted and this button unmutes it
videoSound.addEventListener('click', () => {
  video.muted = !video.muted
  videoSound.textContent = video.muted ? say.soundOff : say.soundOn
  videoSound.setAttribute('aria-pressed', String(!video.muted))
  if (!video.muted) videoPaused = false
  syncVideo()
})

// A video counts as watched only while most of it is on screen, so it pauses as soon as the visitor scrolls on
// to another section. Measured against the screen too, so a video taller than the screen can still play.
const VIEW_STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1]
const mostlyOnScreen = entry =>
  entry.isIntersecting && entry.intersectionRect.height >= 0.6 * Math.min(entry.boundingClientRect.height, entry.rootBounds.height)

new IntersectionObserver(([entry]) => {
  videoVisible = mostlyOnScreen(entry)
  syncVideo()
}, { threshold: VIEW_STEPS }).observe(video)

// The short version: the reel plays the same way, and turning the sound on starts it from the top with its music.
// A click on the picture plays or pauses it, and the media bar below seeks. Without the script it keeps the browser's own controls.
const reel = document.querySelector('.reel-media video')
const reelToggle = document.querySelector('.reel-pause')
const reelSound = document.querySelector('.reel-sound')
const reelSpeaker = document.querySelector('.reel-speaker')
let reelPaused = reduceMotion
let reelVisible = false

reel.controls = false
reelToggle.parentElement.hidden = false
reelSpeaker.hidden = false
reel.poster = phoneScreen ? reel.dataset.posterPhone : reel.dataset.poster

// The poster is the film's title card, 2.6 seconds in. The film loads a screen ahead and waits there,
// so the first play carries on from the poster instead of jumping back to the empty opening.
const REEL_POSTER_AT = 2.6
let reelPrimed = false

function primeReel() {
  if (reelPrimed) return
  reelPrimed = true
  reel.preload = 'auto'
  if (reel.currentTime < REEL_POSTER_AT) reel.currentTime = REEL_POSTER_AT
}

// Only once the page itself has loaded, so the film never competes with the first screen
whenLoaded(() => new IntersectionObserver(([entry]) => { if (entry.isIntersecting) primeReel() }, { rootMargin: '50% 0px' }).observe(reel))

function syncReel() {
  if (reelVisible && !reelPaused) {
    primeReel()
    reel.play().catch(() => {})
  } else {
    reel.pause()
  }
  reelToggle.textContent = reelPaused ? say.play : say.pause
  reelToggle.setAttribute('aria-pressed', String(reelPaused))
}

function toggleReelPlay() {
  reelPaused = !reelPaused
  syncReel()
}

reelToggle.addEventListener('click', toggleReelPlay)
reel.addEventListener('click', toggleReelPlay)

// The seek bar: a native range over a drawn track, kept in step with the film's own clock
const reelSeek = document.querySelector('.reel-seek')
const reelRange = document.querySelector('.reel-range')
const reelNow = document.querySelector('.reel-now')
const reelTotal = document.querySelector('.reel-total')
let reelDragging = false
let reelFrame = 0

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` // taste-skill-ignore: a clock's seconds
const reelLength = () => (Number.isFinite(reel.duration) ? reel.duration : Number(reelRange.max))

function drawReelTime() {
  const time = reelDragging ? Number(reelRange.value) : reel.currentTime
  reelSeek.style.setProperty('--p', time / reelLength())
  if (!reelDragging) reelRange.value = time
  reelNow.textContent = clock(time)
  reelRange.setAttribute('aria-valuetext', `${clock(time)} ${say.of} ${clock(reelLength())}`)
}

function seekReel(time) {
  reel.currentTime = Math.min(reelLength(), Math.max(0, time))
  drawReelTime()
}

reel.addEventListener('loadedmetadata', () => {
  reelRange.max = reel.duration
  reelTotal.textContent = clock(reel.duration)
  drawReelTime()
})
reel.addEventListener('timeupdate', drawReelTime)
reel.addEventListener('seeked', drawReelTime)

// While it plays, the fill follows every frame rather than the four updates a second timeupdate gives
function followReel() {
  drawReelTime()
  reelFrame = requestAnimationFrame(followReel)
}
reel.addEventListener('play', () => { cancelAnimationFrame(reelFrame); followReel() })
reel.addEventListener('pause', () => cancelAnimationFrame(reelFrame))

reelRange.addEventListener('pointerdown', () => { reelDragging = true })
addEventListener('pointerup', () => { reelDragging = false })
reelRange.addEventListener('input', () => seekReel(Number(reelRange.value)))

// Arrow keys skip two seconds at a time
reelRange.addEventListener('keydown', event => {
  const step = { ArrowLeft: -2, ArrowDown: -2, ArrowRight: 2, ArrowUp: 2 }[event.key]
  if (step === undefined) return
  event.preventDefault()
  seekReel(reel.currentTime + step)
})

// The text button and the speaker on the picture do the same thing and always show the same state
function toggleReelSound() {
  reel.muted = !reel.muted
  reelSound.textContent = reel.muted ? say.soundOff : say.soundOn
  reelSound.setAttribute('aria-pressed', String(!reel.muted))
  reelSpeaker.setAttribute('aria-pressed', String(!reel.muted))
  if (!reel.muted) {
    reel.currentTime = 0
    reelPaused = false
  }
  syncReel()
}

reelSound.addEventListener('click', toggleReelSound)
reelSpeaker.addEventListener('click', toggleReelSound)

new IntersectionObserver(([entry]) => {
  reelVisible = mostlyOnScreen(entry)
  syncReel()
}, { threshold: VIEW_STEPS }).observe(reel)

// Entrances: the parts of each section rise in turn as the section arrives
const groups = new Map()
document.querySelectorAll('[data-rise]').forEach(el => {
  const group = el.closest('article, section, .hero-sheet') || document.body
  if (!groups.has(group)) groups.set(group, [])
  const list = groups.get(group)
  el.style.setProperty('--i', list.length)
  list.push(el)
})

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return
    entry.target.classList.add('in')
    observer.unobserve(entry.target)
  })
}, { rootMargin: '0px 0px -10% 0px' })

document.querySelectorAll('[data-rise]').forEach(el => observer.observe(el))

// Contact: send the message through Web3Forms without leaving the page
const form = document.querySelector('.ask')
const formNote = document.querySelector('#ask-note')
const formButton = form.querySelector('.ask-send')
const askText = document.querySelector('#ask-text')
const askEmail = document.querySelector('#ask-email')
const askNext = form.querySelector('.ask-next')

// First the message, then the email: the arrow down (or Enter) opens the email row
function setFormOpen(open) {
  form.classList.toggle('is-open', open)
  askNext.setAttribute('aria-expanded', String(open))
}

function openEmail() {
  if (!askText.value.trim()) return askText.reportValidity()
  setFormOpen(true)
  askEmail.focus()
}

askText.addEventListener('input', () => form.classList.toggle('has-text', askText.value.trim() !== ''))
askText.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || form.classList.contains('is-open')) return
  event.preventDefault()
  openEmail()
})
askNext.addEventListener('click', openEmail)

form.addEventListener('submit', async event => {
  event.preventDefault()
  formButton.disabled = true
  formNote.textContent = say.sending
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    })
    const result = await response.json()
    if (!result.success) throw new Error(result.message)
    form.reset()
    form.classList.remove('has-text')
    setFormOpen(false)
    formNote.textContent = say.sent
  } catch {
    formNote.textContent = say.failed
  } finally {
    formButton.disabled = false
  }
})

// Switching language keeps the place: both pages share their ids, so the link notes the element
// in the middle of the screen and how far from the top it sits, and the other page scrolls to match.
// Without storage the link falls back to that element's #id.
const placeKey = 'lang-switch-place'
const placeMarks = () => [...document.querySelectorAll('body [id]')].filter(el => el.getClientRects().length)

document.querySelectorAll('a[hreflang]').forEach(link => link.addEventListener('click', () => {
  if (scrollY < 1) return
  const mark = placeMarks().filter(el => el.getBoundingClientRect().top <= innerHeight / 2).pop()
  if (!mark) return
  try {
    sessionStorage.setItem(placeKey, JSON.stringify({ id: mark.id, top: mark.getBoundingClientRect().top, at: Date.now() }))
  } catch {
    link.hash = mark.id
  }
}))

try {
  const place = JSON.parse(sessionStorage.getItem(placeKey))
  sessionStorage.removeItem(placeKey)
  const mark = place && Date.now() - place.at < 30000 && document.getElementById(place.id)
  if (mark) {
    const goTo = () => scrollTo({ top: scrollY + mark.getBoundingClientRect().top - place.top, behavior: 'instant' })
    goTo()
    // Pictures above may still change the layout as they load; follow them unless the visitor has scrolled
    const settled = scrollY
    addEventListener('load', () => { if (Math.abs(scrollY - settled) < 2) goTo() }, { once: true })
  }
} catch {}

// Theme: everyone starts in light; the button switches to dark and back, and the pick is remembered on this device
const root = document.documentElement
const themeButtons = document.querySelectorAll('.theme-switch')
const themeColor = document.querySelector('meta[name="theme-color"]')

function drawTheme() {
  const dark = root.dataset.theme === 'dark'
  themeButtons.forEach(button => button.setAttribute('aria-pressed', String(dark)))
  themeColor.content = dark ? '#0e1518' : '#f7f9fa' // the browser's own bars follow the page
}

themeButtons.forEach(button => {
  button.hidden = false
  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('theme', root.dataset.theme) } catch {}
    drawTheme()
  })
})

drawTheme()
