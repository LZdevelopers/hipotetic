// Roda antes da primeira pintura (script clássico e síncrono no <head>):
// aplica o tema salvo ou, sem escolha salva, o do sistema — sem "piscar" o
// tema errado. Mantido mínimo de propósito (mesmo padrão do Global-Time).
(function () {
  var tema = null;
  try {
    tema = JSON.parse(localStorage.getItem("hp:tema"));
  } catch (erro) {
    /* armazenamento indisponível: segue o sistema */
  }
  if (tema !== "dark" && tema !== "light") {
    tema = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", tema);
  var cor = document.querySelector('meta[name="theme-color"]');
  if (cor) cor.setAttribute("content", tema === "dark" ? "#0b0b0d" : "#ffffff");
})();
