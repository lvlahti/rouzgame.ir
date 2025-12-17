document.addEventListener("DOMContentLoaded", () => {

  document.querySelector('.right').addEventListener('click', e => {
    e.target.classList.add('move-right');
    // انتقال صفحه بعد از انیمیشن (اختیاری)
    // setTimeout(() => location.href = 'plus-x.html', 800);
  });

  document.querySelector('.left').addEventListener('click', e => {
    e.target.classList.add('move-left');
    // setTimeout(() => location.href = 'minus-x.html', 800);
  });

  document.querySelector('.up').addEventListener('click', e => {
    e.target.classList.add('move-up');
    // setTimeout(() => location.href = 'plus-y.html', 800);
  });

  document.querySelector('.down').addEventListener('click', e => {
    e.target.classList.add('move-down');
    // setTimeout(() => location.href = 'minus-y.html', 800);
  });

});
