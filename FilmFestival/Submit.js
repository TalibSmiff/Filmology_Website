const form = document.getElementById("submit-film-form");

if (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("filmmaker-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const title = document.getElementById("film-title").value.trim();
    const description = document.getElementById("film-description").value.trim();
    const duration = document.getElementById("film-duration").value.trim();
    const date = document.getElementById("submission-date").value.trim();
    const link = document.getElementById("film-link").value.trim();

    const message =
      `New film submission received!\n\n` +
      `Filmmaker: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone || "N/A"}\n` +
      `Title: ${title}\n` +
      `Duration: ${duration} minutes\n` +
      `Submission Date: ${date}\n` +
      `Film Link: ${link}\n\n` +
      `Description:\n${description}`;

    const ownerEmail = "your-email@example.com";
    const ownerSmsNumber = "+15551234567";
    const mailtoLink = `mailto:${ownerEmail}?subject=${encodeURIComponent("New Film Submission")}&body=${encodeURIComponent(message)}`;
    const smsSeparator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
    const smsLink = `sms:${ownerSmsNumber}${smsSeparator}body=${encodeURIComponent(message)}`;
    const shareData = {
      title: "New Film Submission",
      text: message,
      url: link || "",
    };
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    function openMailClient() {
      window.location.href = mailtoLink;
    }

    function openSmsClient() {
      window.location.href = smsLink;
    }

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        isMobile ? openSmsClient() : openMailClient();
      });
    } else {
      isMobile ? openSmsClient() : openMailClient();
    }
  });
}
