const API_BASE_URL = "https://YOUR-BACKEND-DOMAIN.example.com";

const form = document.getElementById("bookingForm");
const submitBtn = document.getElementById("submitBtn");
const modal = document.getElementById("resultModal");
const resultContent = document.getElementById("resultContent");
const closeModal = document.getElementById("closeModal");

function showModal(html) {
    resultContent.innerHTML = html;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
}
closeModal.addEventListener("click", hideModal);
modal.addEventListener("click", e => { if (e.target === modal) hideModal(); });

form.addEventListener("submit", async(event) => {
    event.preventDefault();

    const familyCode = document.getElementById("familyCode").value.trim();
    const memberName = document.getElementById("memberName").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const guestCount = Number(document.getElementById("guestCount").value);
    const checkIn = document.getElementById("checkIn").value;
    const checkOut = document.getElementById("checkOut").value;

    if (!familyCode || !memberName || !phoneNumber || !checkIn || !checkOut) {
        showModal('<p class="error">Please fill in all fields.</p>');
        return;
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
        showModal('<p class="error">Please enter a valid 10-digit phone number.</p>');
        return;
    }
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) {
        showModal('<p class="error">Guest count must be between 1 and 20.</p>');
        return;
    }
    const allowed = ["2026-11-20", "2026-11-21", "2026-11-22"];
    if (!allowed.includes(checkIn) || !allowed.includes(checkOut) || checkOut < checkIn) {
        showModal('<p class="error">Please select valid accommodation dates between 20 and 22 November 2026.</p>');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const response = await fetch(`${API_BASE_URL}/api/registrations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ familyCode, memberName, phoneNumber, guestCount, checkIn, checkOut })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Registration failed.");

        showModal(`
      <h2 class="success-title">Registration Successful</h2>
      <div class="booking-card">
        <strong>Registration No:</strong> ${escapeHtml(data.registration.registrationId)}<br>
        <strong>Family Code:</strong> ${escapeHtml(data.registration.familyCode)}<br>
        <strong>Member:</strong> ${escapeHtml(data.registration.memberName)}<br>
        <strong>Guests:</strong> ${data.registration.guestCount}<br>
        <strong>Check-in:</strong> ${formatDate(data.registration.checkIn)}<br>
        <strong>Check-out:</strong> ${formatDate(data.registration.checkOut)}<br>
        <strong>Status:</strong> ${escapeHtml(data.registration.status)}
      </div>
      <p>Please keep your registration number for future reference.</p>
    `);
        form.reset();
    } catch (error) {
        showModal(`<p class="error">${escapeHtml(error.message)}</p><p>Please try again or contact the helpline.</p>`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
});

function formatDate(value) {
    const d = new Date(value + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[c]));
}