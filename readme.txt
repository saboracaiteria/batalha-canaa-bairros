residencial-canaa/
├── public/                 # Arquivos estáticos (não processados)
│   ├── assets/             # Texturas, Modelos 3D (GLTF/GLB), Sons
│   │   ├── textures/
│   │   ├── models/
│   │   └── sounds/
│   └── favicon.ico
├── src/                    # Todo o código fonte
│   ├── core/               # O "Motor" do jogo
│   │   ├── Game.js         # Classe principal (Singleton), inicia Three.js
│   │   ├── Loop.js         # Controla o requestAnimationFrame e DeltaTime
│   │   ├── Input.js        # Gerencia Toque e Joystick (lógica separada)
│   │   └── Resources.js    # Carregador de assets (Loading Screen)
│   ├── world/              # Tudo relacionado ao cenário
│   │   ├── World.js        # Monta a cena
│   │   ├── Lighting.js     # Sol, Sombras e Ambiente
│   │   ├── Environment.js  # Chão, Montanhas, Árvores
│   │   └── Buildings.js    # Gerador de casas (Procedural)
│   ├── entities/           # Objetos que interagem
│   │   ├── Player.js       # Lógica do jogador local
│   │   ├── Bot.js          # Lógica da IA
│   │   ├── RemotePlayer.js # Jogadores do Multiplayer
│   │   └── Weapon.js       # Lógica de armas e mira
│   ├── systems/            # Sistemas globais
│   │   ├── Physics.js      # Colisões (Hitbox e Raycaster)
│   │   ├── Network.js      # Toda a lógica do Firebase
│   │   ├── Audio.js        # Gerenciador de som 3D
│   │   └── Particle.js     # Sistema de partículas (Sangue, Fumaça)
│   ├── ui/                 # Interface (DOM/HTML)
│   │   ├── HUD.js          # Mira, Vida, Botões
│   │   ├── Menus.js        # Tela inicial, Pause, Lobby
│   │   └── Minimap.js      # Lógica do Canvas 2D do mapa
│   ├── utils/              # Funções auxiliares
│   │   ├── MathUtils.js    # Cálculos de vetor, RNG
│   │   └── ObjectPool.js   # CRÍTICO PARA PERFORMANCE (Reuso de balas)
│   └── main.js             # Ponto de entrada (Entry point)
├── index.html              # O HTML limpo (apenas as divs containers)
├── package.json            # Dependências (Three, Firebase, Vite)
└── vite.config.js          # Configuração de build







Passo 2


Por que essa estrutura garante +60 FPS?
Dividir pastas não aumenta FPS sozinho, mas como você usa essa estrutura sim. Aqui estão os segredos para mobile que essa estrutura facilita:
1. src/utils/ObjectPool.js (O Segredo do FPS)
No seu código atual, você cria (new Mesh) e deleta balas e partículas o tempo todo. Isso causa Garbage Collection, que trava o celular por milissegundos (o famoso "stutter").
Como fazer: Crie um "banco" de 100 balas na memória. Quando atirar, ative uma; quando bater, desative (não delete). Reutilize.
2. src/world/Buildings.js (Instancing)
Atualmente você cria cada parede de cada casa como um Mesh separado. Isso gera muitas Draw Calls (pedidos de desenho para a GPU).
Como fazer: Usar THREE.InstancedMesh. Se houver 50 casas iguais, a GPU desenha 1 vez e replica 50 vezes. Isso triplica a performance em celulares.