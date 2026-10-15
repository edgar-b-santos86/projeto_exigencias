# projeto_exigencias
Projeto de site de exigências cartorárias para registros de contratos imoibiliários

## Como abrir
Abra o `index.html` no navegador (funciona direto do arquivo, sem servidor e sem internet).

## Estrutura
```
index.html            página e todos os dados (exigências e modelos de cláusulas)
estilos/style.css     visual, escrito "mobile first" (celular → tablet → desktop → TV)
scripts/app.js        filtros, busca, copiar texto, abas, Modo TV
fontes/               Public Sans (texto) e Source Serif 4 (títulos), com licença
imagens/capa/         fotos da capa já otimizadas (uma é sorteada a cada visita)
```

## Como adicionar uma exigência
No `index.html`, cada exigência é um cartão dentro da sua camada
(`data-camada="nacional"`, `"estadual"` ou `"cidade"`). Copie um cartão
existente da camada certa e troque os dados:

```html
<article class="card" data-uf="SC" data-cidade="Joinville">
  <header class="card__head">
    <h3 class="card__titulo">Joinville</h3>
    <span class="uf" title="SC">SC</span>
  </header>
  <div class="card__corpo">
    <strong>Cláusula para mencionar no contrato:</strong> texto…
  </div>
  <footer class="card__rodape">
    <time datetime="2026-05-04">Atualizado em 04/05/2026</time>
  </footer>
</article>
```

- `data-cidade` precisa ser igual ao título: é o que aparece no filtro de cidades.
- Em cartões de estado, não use `data-cidade`.
- O botão "Copiar texto" é criado automaticamente.

Modelos de cláusulas ficam em `#listaModelos`, no mesmo formato (sem `data-uf`).

## Links úteis
- `#uf=SC&cidade=Joinville` abre a consulta já filtrada (o endereço se atualiza sozinho; é só copiar e enviar).
- `#aba=modelos` abre direto nos modelos de cláusulas.
- `#tv` liga o Modo TV (letras maiores, foco bem visível para controle remoto); `#tv=0` desliga.
