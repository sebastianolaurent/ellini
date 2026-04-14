const copyButton = document.getElementById('copy-iban');
const ibanText = document.getElementById('iban-text');
const feedback = document.getElementById('copy-feedback');

if (copyButton && ibanText && feedback) {
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ibanText.textContent.trim());
      feedback.textContent = 'IBAN copiato negli appunti.';
    } catch (error) {
      feedback.textContent = 'Copia non riuscita. Seleziona e copia manualmente l\'IBAN.';
    }
  });
}
