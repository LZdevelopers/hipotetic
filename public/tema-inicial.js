// Roda antes da primeira pintura (script clássico e síncrono no <head>):
// aplica o tema salvo ou, sem escolha salva, o ESCURO (padrão da marca) —
// sem "piscar" o tema errado. Mantido mínimo de propósito.
(function () {
  var tema = null;
  try {
    tema = JSON.parse(localStorage.getItem("hp:tema"));
  } catch (erro) {
    /* armazenamento indisponível: usa o padrão */
  }
  if (tema !== "dark" && tema !== "light") tema = "dark";
  document.documentElement.setAttribute("data-theme", tema);
  var cor = document.querySelector('meta[name="theme-color"]');
  if (cor) cor.setAttribute("content", tema === "dark" ? "#0b0b0d" : "#ffffff");
})();
