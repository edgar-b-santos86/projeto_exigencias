/* ==========================================================================
   Exigências cartorárias — comportamento da página

   Sem bibliotecas. Funciona abrindo o index.html direto no navegador.
   O HTML já traz todos os cartões; este script só filtra, ordena a exibição
   por camada (Brasil, estado, cidade), copia textos e guarda o estado da
   consulta no endereço (#uf=SC&cidade=Joinville), para compartilhar o link.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

  /* ---------------------------------------------------------------- texto */

  /* Minúsculas e sem acento, mantendo o MESMO tamanho do texto original
     (necessário para marcar o trecho encontrado no lugar certo). */
  function simplificar(texto) {
    return String(texto || "")
      .replace(/ /g, " ")
      .replace(/[^\u0000-\u007f]/g, (c) => c.normalize("NFD")[0])
      .toLowerCase();
  }

  const termosDe = (consulta) => simplificar(consulta).split(/\s+/).filter(Boolean);

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /* Texto puro de um trecho de HTML, com parágrafos separados por linha em branco. */
  function textoPuro(raiz) {
    const paragrafos = new Set(["P", "LI"]);
    const blocos = new Set(["UL", "OL", "DIV", "H1", "H2", "H3", "TABLE", "TR"]);
    let saida = "";
    (function percorrer(no) {
      if (no.nodeType === Node.TEXT_NODE) {
        saida += no.nodeValue.replace(/\s+/g, " ");
        return;
      }
      if (no.nodeType !== Node.ELEMENT_NODE) return;
      if (no.tagName === "BR") {
        saida += "\n";
        return;
      }
      const quebra = paragrafos.has(no.tagName) ? "\n\n" : blocos.has(no.tagName) ? "\n" : "";
      saida += quebra;
      no.childNodes.forEach(percorrer);
      saida += quebra;
    })(raiz);
    return saida
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* --------------------------------------------------------- armazenamento */

  function guardar(chave, valor) {
    try {
      if (valor === null) localStorage.removeItem(chave);
      else localStorage.setItem(chave, valor);
    } catch (_) {
      /* navegador sem armazenamento: a página funciona do mesmo jeito */
    }
  }
  function ler(chave) {
    try {
      return localStorage.getItem(chave);
    } catch (_) {
      return null;
    }
  }

  /* ------------------------------------------------------------ elementos */

  const raizHtml = document.documentElement;
  const avisoSR = $("#avisoSR");

  const campoBusca = $("#search");
  const selUF = $("#stateFilter");
  const selCidade = $("#cityFilter");
  const btnLimpar = $("#clearFilters");
  const resumo = $("#resultCount");
  const dicaInicial = $("#dicaInicial");
  const avisoUF = $("#avisoUF");
  const semResultados = $("#noResults");
  const camadas = $$("#painel-exigencias .camada");

  const campoModelo = $("#clauseSearch");
  const resumoModelos = $("#resumoModelos");
  const semModelos = $("#noClauseResults");

  const abas = $$('[role="tab"]');
  const paineis = { exigencias: $("#painel-exigencias"), modelos: $("#painel-modelos") };

  /* Índice de busca (montado antes dos botões de copiar entrarem nos cartões) */
  function indexar(cartoes) {
    return cartoes.map((el) => {
      const camada = el.closest(".camada");
      const partes = [$(".card__head", el), $(".card__corpo", el)].filter(Boolean);
      return {
        el,
        tipo: camada ? camada.dataset.camada : "modelo",
        uf: el.dataset.uf || "",
        cidade: el.dataset.cidade || "",
        texto: simplificar(partes.map((p) => p.textContent).join(" ")),
      };
    });
  }
  const exigencias = indexar($$("#painel-exigencias .card"));
  const modelos = indexar($$("#painel-modelos .card"));

  /* ------------------------------------------------------- estado e filtros */

  const estado = { q: "", uf: "", cidade: "", qm: "", aba: "exigencias" };
  let modoTv = ler("modoTv") === "1";

  function atualizarCidades() {
    const nomes = new Set();
    exigencias.forEach((c) => {
      if (c.tipo === "cidade" && c.uf === estado.uf) nomes.add(c.cidade);
    });
    const lista = Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));

    selCidade.innerHTML = "";
    const primeira = document.createElement("option");
    primeira.value = "";
    primeira.textContent = estado.uf ? (lista.length ? "Todas as cidades" : "Sem cidades cadastradas") : "Escolha a UF";
    selCidade.appendChild(primeira);
    lista.forEach((nome) => {
      const op = document.createElement("option");
      op.value = nome;
      op.textContent = nome;
      selCidade.appendChild(op);
    });
    selCidade.disabled = !estado.uf || lista.length === 0;

    if (estado.cidade && !nomes.has(estado.cidade)) estado.cidade = "";
    selCidade.value = estado.cidade;
  }

  function aplicarExigencias() {
    const termos = termosDe(estado.q);
    const temBusca = termos.length > 0;

    const visiveis = exigencias.filter((c) => {
      if (!termos.every((t) => c.texto.includes(t))) return false;
      if (c.tipo === "nacional") return true;
      if (!estado.uf) return temBusca; // sem UF, só aparecem regras regionais se houver busca por texto
      if (c.uf !== estado.uf) return false;
      if (c.tipo === "estadual") return true;
      return !estado.cidade || c.cidade === estado.cidade;
    });
    const conjunto = new Set(visiveis.map((c) => c.el));
    exigencias.forEach((c) => {
      c.el.hidden = !conjunto.has(c.el);
    });

    /* camadas: esconde as vazias, atualiza contagem e fecha o trilho na última */
    let ultima = null;
    camadas.forEach((camada) => {
      const n = visiveis.filter((c) => c.tipo === camada.dataset.camada).length;
      camada.hidden = n === 0;
      $(".camada__qtd", camada).textContent = n;
      camada.classList.remove("is-ultima");
      if (n > 0) ultima = camada;
    });
    if (ultima) ultima.classList.add("is-ultima");

    /* avisos */
    const total = visiveis.length;
    dicaInicial.hidden = !(!estado.uf && !temBusca);
    const ufSemDados = estado.uf && !exigencias.some((c) => c.tipo !== "nacional" && c.uf === estado.uf);
    avisoUF.hidden = !(ufSemDados && !temBusca);
    if (!avisoUF.hidden) {
      $("span", avisoUF).textContent = `Ainda não há exigências específicas cadastradas para ${estado.uf}. Valem as regras de todo o Brasil.`;
    }
    semResultados.hidden = total !== 0;

    /* resumo */
    const por = (tipo) => visiveis.filter((c) => c.tipo === tipo).length;
    const nacional = por("nacional");
    const estadual = por("estadual");
    const cidade = por("cidade");
    if (!estado.uf && !temBusca) {
      resumo.textContent = ""; // a dica inicial já explica o que fazer
    } else if (total === 0) {
      resumo.textContent = "Nenhuma exigência encontrada.";
    } else {
      const onde = estado.cidade ? ` para ${estado.cidade} (${estado.uf})` : estado.uf ? ` para ${estado.uf}` : "";
      const partes = [];
      if (nacional) partes.push([nacional, nacional > 1 ? "nacionais" : "nacional"]);
      if (estadual) partes.push([estadual, estadual > 1 ? "estaduais" : "estadual"]);
      if (cidade) partes.push([cidade, cidade > 1 ? "de cidades" : "de cidade"]);
      const base = plural(total, "exigência", "exigências");
      resumo.textContent =
        partes.length === 1
          ? `${base} ${partes[0][1]}${onde}.`
          : `${base}${onde}: ${partes.map(([n, nome]) => `${n} ${nome}`).join(", ")}.`;
    }

    destacar("busca", visiveis.map((c) => c.el), termos);
    btnLimpar.disabled = !(estado.q || estado.uf || estado.cidade);
  }

  function aplicarModelos() {
    const termos = termosDe(estado.qm);
    let n = 0;
    modelos.forEach((c) => {
      const ok = termos.every((t) => c.texto.includes(t));
      c.el.hidden = !ok;
      if (ok) n++;
    });
    semModelos.hidden = n !== 0;
    if (n === 0) resumoModelos.textContent = "Nenhum modelo encontrado.";
    else if (termos.length) resumoModelos.textContent = `${plural(n, "modelo encontrado", "modelos encontrados")}.`;
    else resumoModelos.textContent = `${plural(n, "modelo", "modelos")}.`;
    $("#listaModelos").hidden = n === 0;
    destacar("busca-modelos", modelos.filter((c) => !c.el.hidden).map((c) => c.el), termos);
  }

  /* -------------------------------------------- destaque do trecho buscado */

  /* Usa a CSS Custom Highlight API (sem mexer no HTML). Em navegadores sem
     suporte, simplesmente não destaca. */
  function destacar(nome, cartoes, termos) {
    if (!("highlights" in CSS) || typeof Highlight === "undefined") return;
    CSS.highlights.delete(nome);
    if (!termos.length) return;
    const faixas = [];
    for (const cartao of cartoes) {
      for (const parte of [$(".card__head", cartao), $(".card__corpo", cartao)]) {
        if (!parte) continue;
        const andador = document.createTreeWalker(parte, NodeFilter.SHOW_TEXT);
        let no;
        while ((no = andador.nextNode())) {
          const base = simplificar(no.nodeValue);
          for (const termo of termos) {
            let i = base.indexOf(termo);
            while (i !== -1 && faixas.length < 3000) {
              const faixa = new Range();
              faixa.setStart(no, i);
              faixa.setEnd(no, i + termo.length);
              faixas.push(faixa);
              i = base.indexOf(termo, i + termo.length);
            }
          }
        }
      }
    }
    if (faixas.length) CSS.highlights.set(nome, new Highlight(...faixas));
  }

  /* ----------------------------------------------- endereço (#uf=SC&...) */

  function lerEndereco() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ""));
    estado.q = p.get("q") || "";
    estado.uf = (p.get("uf") || "").toUpperCase();
    estado.cidade = p.get("cidade") || "";
    estado.qm = p.get("qm") || "";
    estado.aba = p.get("aba") === "modelos" ? "modelos" : "exigencias";
    if (!$(`#stateFilter option[value="${estado.uf}"]`)) estado.uf = "";
    if (p.has("tv")) {
      modoTv = p.get("tv") !== "0";
      guardar("modoTv", modoTv ? "1" : null);
    }
  }

  function gravarEndereco() {
    const p = new URLSearchParams();
    if (estado.aba === "modelos") {
      p.set("aba", "modelos");
      if (estado.qm) p.set("qm", estado.qm);
    } else {
      if (estado.q) p.set("q", estado.q);
      if (estado.uf) p.set("uf", estado.uf);
      if (estado.cidade) p.set("cidade", estado.cidade);
    }
    const hash = p.toString();
    try {
      history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
    } catch (_) {
      /* alguns navegadores bloqueiam replaceState em file:// — sem problema */
    }
  }

  /* ----------------------------------------------------- campos na tela */

  function sincronizarCampos() {
    campoBusca.value = estado.q;
    selUF.value = estado.uf;
    atualizarCidades();
    campoModelo.value = estado.qm;
  }

  function limparExigencias() {
    estado.q = estado.uf = estado.cidade = "";
    sincronizarCampos();
    aplicarExigencias();
    gravarEndereco();
  }

  campoBusca.addEventListener("input", () => {
    estado.q = campoBusca.value;
    aplicarExigencias();
    gravarEndereco();
  });
  selUF.addEventListener("change", () => {
    estado.uf = selUF.value;
    estado.cidade = "";
    atualizarCidades();
    aplicarExigencias();
    gravarEndereco();
  });
  selCidade.addEventListener("change", () => {
    estado.cidade = selCidade.value;
    aplicarExigencias();
    gravarEndereco();
  });
  btnLimpar.addEventListener("click", limparExigencias);
  $('[data-acao="limpar"]').addEventListener("click", () => {
    limparExigencias();
    campoBusca.focus();
  });

  campoModelo.addEventListener("input", () => {
    estado.qm = campoModelo.value;
    aplicarModelos();
    gravarEndereco();
  });
  $('[data-acao="limpar-modelos"]').addEventListener("click", () => {
    estado.qm = "";
    campoModelo.value = "";
    aplicarModelos();
    gravarEndereco();
    campoModelo.focus();
  });

  /* Enter no teclado do celular: fecha o teclado e leva aos resultados */
  const telaLarga = window.matchMedia("(min-width: 64rem)");
  $$("form[role='search']").forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!telaLarga.matches) {
        const alvo = form.closest(".layout").querySelector(".resultados");
        if (alvo) alvo.scrollIntoView({ block: "start" });
      }
    })
  );

  /* Esc limpa o campo de busca; "/" leva o cursor até ele */
  [campoBusca, campoModelo].forEach((campo) =>
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && campo.value) {
        campo.value = "";
        campo.dispatchEvent(new Event("input"));
      }
    })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = document.activeElement;
    if (alvo && /^(INPUT|SELECT|TEXTAREA)$/.test(alvo.tagName)) return;
    e.preventDefault();
    (estado.aba === "modelos" ? campoModelo : campoBusca).focus();
  });

  /* -------------------------------------------------------------- abas */

  function mostrarAba(nome, { foco = false, gravar = true } = {}) {
    estado.aba = nome;
    abas.forEach((aba) => {
      const ativa = aba.id === `aba-${nome}`;
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      if (ativa && foco) aba.focus();
    });
    paineis.exigencias.hidden = nome !== "exigencias";
    paineis.modelos.hidden = nome !== "modelos";
    if (gravar) gravarEndereco();
  }

  abas.forEach((aba, i) => {
    aba.addEventListener("click", () => mostrarAba(aba.id.replace("aba-", "")));
    aba.addEventListener("keydown", (e) => {
      const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (passo) {
        e.preventDefault();
        mostrarAba(abas[(i + passo + abas.length) % abas.length].id.replace("aba-", ""), { foco: true });
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        mostrarAba(abas[e.key === "Home" ? 0 : abas.length - 1].id.replace("aba-", ""), { foco: true });
      }
    });
  });

  /* ------------------------------------------------------ copiar texto */

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_) {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  function criarBotaoCopiar(cartao) {
    const rodape = $(".card__rodape", cartao);
    if (!rodape) return;
    const titulo = $(".card__titulo", cartao);
    const rotulo = "Copiar texto";

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao botao--copiar";
    botao.innerHTML = `<svg aria-hidden="true" focusable="false"><use href="#i-copiar"/></svg><span>${rotulo}</span>`;
    const rotuloAcessivel = titulo ? `Copiar texto: ${titulo.textContent.trim()}` : "Copiar texto: exigência para todo o Brasil";
    botao.setAttribute("aria-label", rotuloAcessivel);

    let relogio;
    botao.addEventListener("click", async () => {
      const ok = await copiarTexto(textoPuro($(".card__corpo", cartao)));
      const rotuloSpan = $("span", botao);
      clearTimeout(relogio);
      if (ok) {
        botao.removeAttribute("aria-label");
        botao.dataset.copiado = "";
        rotuloSpan.textContent = "Texto copiado";
        $("use", botao).setAttribute("href", "#i-ok");
        avisoSR.textContent = "Texto copiado.";
      } else {
        rotuloSpan.textContent = "Não foi possível copiar";
        avisoSR.textContent = "Não foi possível copiar. Selecione o texto e copie manualmente.";
      }
      relogio = setTimeout(() => {
        botao.setAttribute("aria-label", rotuloAcessivel);
        delete botao.dataset.copiado;
        rotuloSpan.textContent = rotulo;
        $("use", botao).setAttribute("href", "#i-copiar");
        avisoSR.textContent = "";
      }, 2200);
    });
    rodape.appendChild(botao);
  }
  $$(".card").forEach(criarBotaoCopiar);

  /* ------------------------------------------------- voltar ao topo */

  const botaoTopo = $("#voltarTopo");
  let esperandoQuadro = false;
  function atualizarBotaoTopo() {
    esperandoQuadro = false;
    botaoTopo.hidden = window.scrollY < window.innerHeight * 1.2;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!esperandoQuadro) {
        esperandoQuadro = true;
        requestAnimationFrame(atualizarBotaoTopo);
      }
    },
    { passive: true }
  );
  botaoTopo.addEventListener("click", () => {
    window.scrollTo({ top: 0 });
    (estado.aba === "modelos" ? campoModelo : campoBusca).focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------ Modo TV */

  const botaoTv = $("#modoTv");
  function aplicarModoTv(ligado) {
    raizHtml.classList.toggle("modo-tv", ligado);
    botaoTv.setAttribute("aria-pressed", String(ligado));
  }
  botaoTv.addEventListener("click", () => {
    modoTv = !modoTv;
    aplicarModoTv(modoTv);
    guardar("modoTv", modoTv ? "1" : null);
  });

  /* ---------------------------------------------------- foto da capa */

  /* Sorteia uma foto por visita, sem repetir a anterior. */
  function sortearCapa() {
    const numeros = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    let anterior = null;
    try {
      anterior = sessionStorage.getItem("ultimaCapa");
    } catch (_) {
      anterior = null;
    }
    let n;
    do {
      n = numeros[Math.floor(Math.random() * numeros.length)];
    } while (String(n) === anterior && numeros.length > 1);
    try {
      sessionStorage.setItem("ultimaCapa", String(n));
    } catch (_) {
      /* sem sessionStorage: segue sem a regra de não repetir */
    }
    $(".capa").style.backgroundImage = `url("imagens/capa/capa-${n}.webp")`;
  }

  /* ------------------------------------------------------------ início */

  lerEndereco();
  aplicarModoTv(modoTv);
  sincronizarCampos();
  mostrarAba(estado.aba, { gravar: false });
  aplicarExigencias();
  aplicarModelos();
  atualizarBotaoTopo();
  sortearCapa();

  window.addEventListener("hashchange", () => {
    lerEndereco();
    aplicarModoTv(modoTv);
    sincronizarCampos();
    mostrarAba(estado.aba, { gravar: false });
    aplicarExigencias();
    aplicarModelos();
  });
})();
