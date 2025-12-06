/* ============================================
   SIGN UP PAGE JAVASCRIPT
   ============================================
   
   Functions:
   1. Form Validation
   2. Form Submission (stores to localStorage + sessionStorage)
   3. Social Login Handlers (placeholder)
   4. Check if user already logged in
   
   TODO: BACKEND INTEGRATION
   - Connect form submission to your authentication backend
   - Implement actual OAuth for Google/Facebook
   
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form")
  const firstNameInput = document.getElementById("first-name")
  const surnameInput = document.getElementById("surname")
  const emailInput = document.getElementById("email")
  const passwordInput = document.getElementById("password")

  /* ============================================
       CHECK IF USER ALREADY LOGGED IN
       Redirect to profile if session exists
       ============================================ */
  const existingSession = sessionStorage.getItem("forgeblock_user")
  if (existingSession) {
    window.location.href = "profile.html"
    return
  }

  /* ============================================
       FORM SUBMISSION HANDLER
       
       TODO: BACKEND INTEGRATION
       Replace localStorage/sessionStorage with actual API call:
       
       async function submitForm(data) {
           const response = await fetch('YOUR_API_ENDPOINT/auth/signup', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(data)
           });
           return response.json();
       }
       ============================================ */

  signupForm.addEventListener("submit", (e) => {
    e.preventDefault()

    // Get form values
    const firstName = firstNameInput.value.trim()
    const surname = surnameInput.value.trim()
    const email = emailInput.value.trim()
    const password = passwordInput.value

    // Basic validation
    if (!firstName || !surname || !email || !password) {
      alert("Please fill in all fields")
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address")
      return
    }

    // Password validation (minimum 6 characters)
    if (password.length < 6) {
      alert("Password must be at least 6 characters")
      return
    }

    /*
     * TODO: BACKEND INTEGRATION
     * Replace this localStorage/sessionStorage code with your actual API call
     * Example:
     *
     * try {
     *     const result = await submitForm({ firstName, surname, email, password });
     *     if (result.success) {
     *         sessionStorage.setItem('forgeblock_user', JSON.stringify(result.user));
     *         window.location.href = 'profile.html';
     *     } else {
     *         alert(result.message);
     *     }
     * } catch (error) {
     *     console.error('Signup error:', error);
     *     alert('An error occurred. Please try again.');
     * }
     */

    // Create user data object
    const userData = {
      firstName: firstName,
      surname: surname,
      name: `${firstName} ${surname}`, // Combined for display
      email: email,
      password: password, // TODO: In production, hash this on the backend
      role: "Staff",
      dateJoined: new Date().toISOString(),
      signatures: [],
      enrolledUsers: [],
      forgedReports: [],
    }

    // Get existing users from localStorage (acts as temporary database)
    const allUsers = JSON.parse(localStorage.getItem("forgeblock_users") || "[]")

    // Check if email already exists
    const existingUserIndex = allUsers.findIndex((u) => u.email === email)
    if (existingUserIndex >= 0) {
      alert("An account with this email already exists. Please sign in instead.")
      return
    }

    // Add new user
    allUsers.push(userData)

    // Save users database to localStorage
    localStorage.setItem("forgeblock_users", JSON.stringify(allUsers))

    // Save current session to sessionStorage
    sessionStorage.setItem("forgeblock_user", JSON.stringify(userData))

    // Redirect to profile page
    window.location.href = "profile.html"
  })

  /* ============================================
       SOCIAL LOGIN HANDLERS
       
       TODO: BACKEND INTEGRATION
       Implement OAuth authentication:
       
       For Google:
       - Use Google Identity Services
       - Initialize with your Google Client ID
       - Handle the credential response
       
       For Facebook:
       - Use Facebook SDK
       - Initialize with your App ID
       - Handle the login response
       ============================================ */

  const googleBtn = document.querySelector(".btn-google")
  const facebookBtn = document.querySelector(".btn-facebook")

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      /*
       * TODO: Implement Google OAuth
       *
       * google.accounts.id.initialize({
       *     client_id: 'YOUR_GOOGLE_CLIENT_ID',
       *     callback: handleGoogleResponse
       * });
       * google.accounts.id.prompt();
       */

      alert("Google Sign-In: Connect to your OAuth backend")
    })
  }

  if (facebookBtn) {
    facebookBtn.addEventListener("click", () => {
      /*
       * TODO: Implement Facebook OAuth
       *
       * FB.login(function(response) {
       *     if (response.authResponse) {
       *         handleFacebookResponse(response);
       *     }
       * }, {scope: 'email,public_profile'});
       */

      alert("Outlook Sign-In: Connect to your OAuth backend")
    })
  }
})
