/* ============================================
   LANDING PAGE JAVASCRIPT
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================
       TYPING ANIMATION
       ============================================ */

  const typingElement = document.getElementById("typing-text")
  const phrases = ["ForgeBlock", "Detects Forgery", "Verifies Authenticity"]

  let phraseIndex = 0
  let charIndex = 0
  let isDeleting = false
  let typingSpeed = 100

  function typeAnimation() {
    const currentPhrase = phrases[phraseIndex]

    if (isDeleting) {
      typingElement.textContent = currentPhrase.substring(0, charIndex - 1)
      charIndex--
      typingSpeed = 50
    } else {
      typingElement.textContent = currentPhrase.substring(0, charIndex + 1)
      charIndex++
      typingSpeed = 100
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
      typingSpeed = 2000
      isDeleting = true
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false
      phraseIndex = (phraseIndex + 1) % phrases.length
      typingSpeed = 500
    }

    setTimeout(typeAnimation, typingSpeed)
  }

  typeAnimation()

  /* ============================================
       AUTH STATE CHECK - Update UI based on login status
       ============================================ */

  const userDataStr = sessionStorage.getItem("forgeblock_user")
  const btnGetStarted = document.getElementById("btn-get-started")
  const btnSignupNow = document.getElementById("btn-signup-now")
  const btnSigninHero = document.getElementById("btn-signin-hero")
  const navProfileLink = document.querySelector('.nav-link[href="profile.html"]')

  if (userDataStr) {
    // User is logged in
    const userData = JSON.parse(userDataStr)
    const firstName = userData.name ? userData.name.split(" ")[0] : "Profile"

    // Update nav profile link to show first name
    if (navProfileLink) {
      navProfileLink.textContent = firstName
    }

    // Redirect "Get Started" and "Sign Up Now" buttons to profile if already logged in
    if (btnGetStarted) {
      btnGetStarted.href = "profile.html"
      const btnText = btnGetStarted.querySelector(".btn-text")
      if (btnText) {
        btnText.textContent = "Go to Profile"
      }
    }

    if (btnSignupNow) {
      btnSignupNow.href = "profile.html"
      btnSignupNow.textContent = "Go to Profile"
    }

    // Hide sign in button if already logged in
    if (btnSigninHero) {
      btnSigninHero.style.display = "none"
    }
  } else {
    // User is not logged in - ensure buttons point to correct pages
    if (navProfileLink) {
      navProfileLink.textContent = "Profile"
    }

    // Ensure Get Started goes to signup
    if (btnGetStarted) {
      btnGetStarted.href = "signup.html"
    }

    // Ensure Sign Up Now goes to signup
    if (btnSignupNow) {
      btnSignupNow.href = "signup.html"
    }

    // Show sign in button
    if (btnSigninHero) {
      btnSigninHero.style.display = "inline-flex"
    }
  }
})
