# GoLedger Challenge - Web Experience

Este projeto é uma plataforma de catálogo de filmes e séries desenvolvida para o desafio técnico da **GoLedger**. A aplicação consome uma API (GoLedger Backend) e oferece uma interface moderna, responsiva e com foco em experiência do usuário (UX/UI).

## 🚀 Diferenciais do Projeto: As "Duas Homes"

Uma das principais características deste projeto é a existência de duas experiências de Home, permitindo alternar entre uma visão focada nos dados brutos e uma visão enriquecida visualmente.

### 🏠 Home 1 (Padrão)
Acesse via `/` ou `index.html`.
*   Focada na estrutura de dados vinda diretamente do backend GoLedger.
*   Exibe as categorias e itens cadastrados no blockchain.
*   Ideal para validar a consistência dos dados e a integração pura com o ledger.

### 🎬 Home 2 (Enriquecida com Capas)
Acesse via `#/inicio2` ou clicando no atalho do sistema.
*   **Problema:** O backend original da GoLedger não fornece URLs de imagens (capas/posters) para os ativos.
*   **Solução:** Esta versão utiliza uma integração com a **API do TMDB (The Movie Database)** para buscar automaticamente capas, backgrounds e avaliações baseadas no título dos ativos.
*   **Experiência Visual:** Interface estilo "Streaming" (Netflix/Disney+), com Hero dinâmico, posters de alta qualidade e glassmorphism.
## 🔑 Acesso e Testes (Facilitados)

Para agilizar o processo de avaliação, use as seguintes credenciais:

*   **Painel Administrativo:** 
    *   **Usuário:** `admin`
    *   **Senha:** `admin`

*   **API de Capas (TMDB):**
    *   Um Token de Leitura (Bearer) já está configurado no projeto para que as capas carreguem automaticamente na "Home 2".

## 🛠️ Tecnologias Utilizadas

*   **Vite + React:** Para um desenvolvimento rápido e performance otimizada.
*   **Vanilla CSS:** Layouts modernos utilizando CSS Variables, Flexbox, Grid e efeitos de Glassmorphism (sem dependência de frameworks pesados).
*   **GoLedger API:** Integração direta com o backend em Hyperledger Fabric.
*   **TMDB API:** Enriquecimento de metadados visuais.

## 📦 Como Executar

1.  Clone o repositório.
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
4.  Abra o navegador no endereço indicado (geralmente `http://localhost:5173`).

---

**Desenvolvido por Ivan Jacques da Silva** - Desafio GoLedger.
