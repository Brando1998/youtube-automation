# Reglas de composición — biblioteca vectorial

Reglas aprendidas construyendo Rocco (segundo personaje), después de 3 rondas de
fallos visuales con la cola. Equivalente 2D de las reglas que ya existen para el
pipeline 3D de Blender (`docs/PROGRESS.md`, sección "Lección reutilizable"). No son
preferencias de estilo — cada una corrige un error real que ya pasó.

## R1 — Geometría exacta, no curvas adivinadas

Cualquier forma que deba leerse como "pegada" o "emergiendo de" otra pieza (colas,
orejas, cuernos, ramas) se construye desde **círculos y su geometría exacta**
(`FormaAhusada` en `primitives.tsx`: base ancha + punta angosta, tangentes
calculadas, no estimadas), nunca con curvas Bézier escritas a mano adivinando
puntos de control.

**Por qué**: la cola original de Rocco (`rocco.tsx`, versión descartada) era un
`<path>` con curvas `Q` a mano — se veía como un triángulo/aleta flotante. Adivinar
coordenadas de curvas no da ninguna garantía de que la forma conecte bien con nada.

## R2a — Fusión sólida (sin máscara): solape profundo

Si la pieza hija se pinta encima del padre y se espera que el color la "funde"
visualmente (sin recorte), su punto de anclaje debe quedar metido **al menos el
50% de su propio radio** dentro de la silueta del padre — misma convención que los
puntos de attachment en rigs 3D estándar, y la misma lección que
`assets/vegetacion/arbusto.py` (fundir metaballs superponiendo, no solo tocando).

Función: `validarAnclaje(ancla, padreComoCirculo, minFraccion=0.5)` en `primitives.tsx`.

## R2b — Recorte con máscara: cerca del borde, no profundo

Si en cambio se usa un `<mask>` para ocultar la parte de la pieza que cae dentro
del padre (la técnica real de la cola de Rocco), la regla es **la opuesta**: el
centro del anclaje debe quedar **cerca del borde** del padre, no profundamente
adentro — si quedara muy adentro, la máscara ocultaría casi toda la pieza; si queda
muy afuera, no hay nada que fundir y se ve flotando.

El padre se aproxima como **elipse**, no como círculo — `CuerpoBlob` casi nunca es
circular en la práctica.

Función: `validarAnclajeConMascara(ancla, padreComoElipse, toleranciaFraccion=0.6)`
en `primitives.tsx`.

**Por qué dos reglas y no una**: la primera versión de este documento solo tenía
R2a, copiada de estándares de rigging 3D sólido. Al probarla contra la cola YA
APROBADA de Rocco, la reprobó — porque esa cola usa máscara, no fusión sólida, y
son geométricamente opuestas (una pide solape profundo, la otra pide solape nulo).
Antes de aplicar una regla de "otro dominio", confirmar que la técnica es la misma.

## R3 — Siempre renderizar y mirar antes de mostrar

Ningún asset nuevo se presenta al usuario sin haber corrido `npm run still` (cero
AWS, local) e inspeccionado el PNG resultante al menos una vez. El primer intento
nunca se entrega sin verificar.

## R4 — Validador automático de siluetas antes de pedir aprobación

Correr `npm run validar <preview.png>` (`scripts/validar_silueta.mjs`) sobre el
render antes de mostrarlo. Detecta por conteo de píxeles si hay una región grande
desconectada del cuerpo principal (>25% del tamaño de la región principal) — señal
de alerta, no un fallo automático ciego (hay piezas sueltas legítimas, como un
prop). Repasar la lista de componentes reportada antes de decidir.

**Límite conocido** (encontrado probándolo contra `rocco_v4.png`, la cola
triangular que el usuario rechazó): este validador solo detecta **huecos reales**
de fondo entre piezas. Una pieza que toca al cuerpo por una esquina de 1 píxel
pasa la prueba de conectividad igual, aunque se vea claramente mal — por eso R2a/R2b
(que miden cuánto solapan, no si se tocan) son el chequeo que de verdad importa
para esto; el validador de píxeles es una red de seguridad barata, no el chequeo
principal.

## R5 — Probar técnicas nuevas de SVG aisladas antes de usarlas en un personaje real

Cualquier técnica de SVG nunca usada antes en la biblioteca (máscaras, filtros,
clip-paths) se prueba en una composición de prueba aislada antes de aplicarla a un
personaje real. El bug de `maskUnits="userSpaceOnUse"` (hizo desaparecer la cola
por completo) se habría detectado en segundos aislado, en vez de depurarlo dentro
de todo el árbol de transforms anidados de `CharacterPuppet`.

## R6 — Props/objetos sueltos se declaran como tales

Una pieza que a propósito NO debe tocar el cuerpo (un hueso en el suelo, un objeto
en la mano) no tiene que pasar R2a/R2b — pero debe quedar claramente fuera de la
silueta del cuerpo (sin solape parcial ambiguo) para que no se confunda con un
error de fusión a medias.
