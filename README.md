# Juego de Penales 3D con Three.js

## Introducción

El presente proyecto consiste en el desarrollo de una aplicación WebGL interactiva basada en la librería **Three.js**, cuyo propósito es simular un juego de penales en un entorno tridimensional.  
La aplicación integra elementos de modelado 3D, animación, interacción mediante teclado y mouse, efectos visuales, audio y control de colisiones, permitiendo ofrecer una experiencia de usuario dinámica e inmersiva.

Este trabajo fue realizado con el objetivo de aplicar los conocimientos adquiridos en el desarrollo de ambientes virtuales, implementando una solución funcional que combina aspectos visuales, lógicos y de interacción dentro de un escenario 3D.

---

## Objetivo del proyecto

Desarrollar una aplicación WebGL en Three.js que permita al usuario interactuar con un escenario tridimensional, controlar un jugador en una tanda de penales, realizar disparos a portería y cumplir metas por nivel mediante el uso de animaciones, efectos visuales, sonido y control de colisiones.

---

## Descripción general

La aplicación representa una cancha de fútbol en 3D en la que un jugador puede desplazarse, apuntar y disparar el balón hacia una portería defendida por un portero animado.  
El sistema incorpora una lógica de niveles, donde cada uno establece una cantidad de goles meta, un tiempo límite y un número de tiros disponibles. El usuario debe cumplir con los objetivos establecidos para avanzar al siguiente nivel.

Además, se incluyen animaciones específicas para el personaje principal, tales como:

- pose inicial o de espera
- animación de disparo
- animación de celebración al anotar gol

De igual forma, el portero cuenta con animaciones de reacción, lo que incrementa el realismo e interacción del juego.

---

## Características del sistema

- Escenario tridimensional basado en una cancha de fútbol
- Jugador modelado en 3D con animaciones FBX
- Portero con animaciones de atajada
- Sistema de niveles con dificultad progresiva
- Temporizador por nivel
- Control de tiros restantes
- Conteo de goles anotados
- Meta de goles por nivel
- Movimiento del jugador por teclado
- Control de cámara con mouse
- Disparo del balón en dirección apuntada
- Guía visual para la dirección del disparo
- Efectos visuales al patear el balón
- Reproducción de sonidos para acciones del juego
- Detección de colisiones en el escenario
- Interfaz gráfica superpuesta con información en tiempo real

---

## Tecnologías utilizadas

Para el desarrollo del proyecto se emplearon las siguientes tecnologías y herramientas:

- **HTML5**
- **CSS3**
- **JavaScript**
- **Three.js**
- **GLTFLoader**
- **FBXLoader**
- **Octree**
- **Capsule**
- **Stats.js**

Estas herramientas permitieron construir la lógica, la representación gráfica y la interacción dentro del entorno 3D.

---

## Estructura del proyecto

```text
Examen Tema 2/
│
├── audio/
│   ├── kick.wav
│   ├── goal.wav
│   ├── save.wav
│   └── fail.wav
│
├── goalkeeper/
│   ├── Portero.fbx
│   ├── Catch1.fbx
│   ├── Catch2.fbx
│   └── Dive.fbx
│
├── models/
│   ├── scene.gltf
│   ├── scene.bin
│   └── textures/
│
├── player/
│   ├── Jugador.fbx
│   ├── Pose.fbx
│   ├── Disparo.fbx
│   └── Celebracion.fbx
│
├── index.html
├── main.js
└── README.md
