// 웹페이지에서 드래그 시작 시 선택된 텍스트를 캡처
document.addEventListener('dragstart', (e) => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    e.dataTransfer.setData('text/plain', selectedText);
    e.dataTransfer.effectAllowed = 'copy';
  }
});