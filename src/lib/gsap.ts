import gsap from 'gsap'

// Time-based animation even when frames are slow (low-end phones, headless screenshots):
// without this, GSAP's lag smoothing stretches every long frame to 33 ms and intros crawl.
gsap.ticker.lagSmoothing(0)

export default gsap
