# 3BUK — Documento Maestro del Proyecto
> *"Sua racha é seu mérito."*

---

## 1. Visión General

**3BUK** es una plataforma digital para deportistas amateurs en Brasil que premia la **constancia** y la **actitud**, no el talento ni la performance. Los usuarios participan en campañas subiendo fotos y videos de sus entrenamientos, y un administrador califica y asigna patrocinios basándose en tres criterios: Actitud, Compromiso y Continuidad.

**Mercado inicial:** Brasil  
**Stack de desarrollo:** A definir (vibe coding)  
**Modelo de negocio:** Freemium con suscripción mensual  
**Estado actual:** En desarrollo (vibe coding activo)  
**Hashtag oficial:** #3bukchallenge

---

## 2. Problema que resuelve

Los deportistas amateurs abandonan o entrenan de forma irregular porque:

- Sostener el hábito tiene un costo mental, económico y social alto
- El ecosistema actual premia talento y performance, no actitud ni constancia
- El esfuerzo "invisible" nunca se reconoce
- No existe un sistema externo que sostenga la motivación cuando baja
- Las comunidades existentes son informales, temporales y desconectadas

**La brecha central:** hay una distancia enorme entre quién *merece* apoyo (por esfuerzo y hábito) y quién *recibe* apoyo (por performance y visibilidad).

---

## 3. Estados del Sistema

Estos son los estados que el sistema almacena y gestiona en toda la plataforma:

### Estado de Participación
| Estado | Descripción |
|---|---|
| **EN CURSO** | El usuario hizo click en "Participar" — inscripción activa |
| **CONCLUIDO** | El usuario subió su evidencia antes del cierre de la campaña |
| **NO CONCLUIDO** | La campaña cerró y el usuario no subió evidencia |
| **CALIFICADO** | El admin completó la calificación (Actitud + Compromiso + Continuidad) |
| **GANADOR** | El admin marcó al participante como ganador de la campaña |

### Estado de Campaña
| Estado | Descripción |
|---|---|
| **ABIERTO** | Campaña activa, dentro del período de fechas |
| **CONCLUIDO** | Campaña cerrada por fecha de fin |
| **ELIMINADO** | Campaña eliminada por el admin |
| **CALIFICADO** | Todos los participantes elegibles han sido calificados |

### Estado de Usuario
| Estado | Descripción |
|---|---|
| **ACTIVO** | Usuario habilitado para participar |
| **DESHABILITADO** | Usuario bloqueado por el admin, no puede participar |

---

## 4. Cómo Funciona (Core Loop)

### 4.1 Campañas
El admin crea campañas con: nombre, deporte (de tabla maestra), estado geográfico (de tabla maestra), ciudad, fechas de inicio y fin, descripción del desafío, plan al que aplica (Freemium o Premium), hashtag de Instagram opcional, y cantidad de ganadores con sus premios.

Cada campaña es **exclusiva para un plan**: los usuarios Freemium solo ven campañas Freemium, los Premium solo ven campañas Premium.

### 4.2 Flujo de participación del usuario

```
1. Usuario ve campaña disponible (Tab Campañas)
2. Click "Participar" → su estado de participación cambia a "EN CURSO"
3. Tab Mis Participaciones → ve la campaña con estado "EN CURSO"
4. Sube evidencia (fotos/videos + comentario + checkbox IG)
   → su estado de participación cambia a "CONCLUIDO"
5. Al vencer la fecha de fin:
   → Si subió evidencia: estado permanece "CONCLUIDO"
   → Si no subió evidencia: estado cambia automáticamente a "NO CONCLUIDO"
6. Admin califica en Tab Calificación → estado pasa a "CALIFICADO"
7. Admin marca ganador → estado pasa a "GANADOR"
```

### 4.3 Condiciones para habilitar "Subir evidencia"
El botón de subida de evidencia tiene tres estados posibles:
- **Habilitado** (verde): SOLO si se cumplen LAS DOS condiciones:
  1. El admin aprobó la participación del usuario
  2. La campaña está en estado **ABIERTO** (dentro de fechas)
- **Deshabilitado** — *"Aguardando aprovação do admin"*: si el admin aún no aprobó
- **Deshabilitado** — *"Campanha encerrada"*: si la campaña ya no está ABIERTA

### 4.4 Evidencia del usuario
El usuario envía desde el Tab "Mis Participaciones":
- **Fotos** (múltiples) y/o **video**
- **Comentario** sobre su participación (opcional)
- **Checkbox** confirmando publicación en Instagram con el hashtag de la campaña (si aplica)

---

## 5. Sistema de Calificación del Admin

### 5.1 Filosofía
La calificación es manual. El admin revisa la evidencia real y califica con tres criterios numéricos. La fórmula genera un puntaje total que orienta — pero no reemplaza — la decisión humana de elegir al ganador.

### 5.2 Elegibilidad para calificación
Solo aparecen en el Tab Calificación los participantes que cumplan **las tres condiciones**:
- Estado de participación: **CONCLUIDO**
- Estado de campaña: **CONCLUIDO**
- Estado de usuario: **ACTIVO**

### 5.3 Los tres criterios de calificación

#### 🔥 Actitud (1–10, permite decimales)
> *Cómo se muestra el atleta en sus fotos y videos: energía, carisma, presencia.*
- El admin revisa toda la evidencia multimedia
- Ingresa una nota del 1 al 10 (permite decimales, ej: 8.5)

#### 💪 Compromiso (valor fijo: 10)
> *Si el participante está en estado CONCLUIDO, significa que cumplió el desafío.*
- Este campo se llena automáticamente con **10** por defecto
- No es editable (el hecho de haber concluido ya es la máxima nota de compromiso)

#### 📅 Continuidad (1–10, permite decimales)
> *Si participa de forma constante, incluso sin ganar.*
- El admin ingresa una nota del 1 al 10 (permite decimales)
- Se valora el historial de participaciones anteriores del usuario

#### ∑ Total (calculado automáticamente)
- Suma de los tres campos: Actitud + Compromiso + Continuidad
- Máximo posible: 30 puntos
- Se calcula y muestra en tiempo real al completar los tres campos
- Al completar los tres campos → estado de participación pasa a **CALIFICADO**

### 5.4 Selección de ganador
- Botón **"Marcar como ganador"** disponible en cada registro del Tab Calificación
- Al hacer click → estado de participación pasa a **GANADOR**
- Solo los participantes con estado **GANADOR** aparecen en el Tab Ganadores

### 5.5 Vista de detalle (desde Tab Calificación)
Botón "Detalles" en cada registro abre ventana/modal con toda la evidencia del formulario de participación:
- Galería completa de fotos y videos subidos
- Comentario del participante
- Badge de publicación en Instagram: ✅ sí / ❌ no

---

## 6. Estructura de Navegación

### Usuario (4 tabs)
| Tab | Contenido |
|---|---|
| **Campanhas** | Campañas disponibles según plan + filtro por deporte + filtro por estado (ubicación geográfica) |
| **Minhas Participações** | Lista de campañas inscritas con estado: EN CURSO / CONCLUIDO / NO CONCLUIDO |
| **Notificações** | Historial cronológico de cambios de estado |
| **Meu Perfil** | Datos del perfil + formulario de edición + galería de participaciones |

### Admin (8 tabs)
| Tab | Contenido |
|---|---|
| **Usuários** | Lista de atletas con estado ACTIVO/DESHABILITADO + botón Deshabilitar |
| **Campanhas** | Reporte de campañas + botón Nueva Campaña |
| **Participações** | Reporte completo de participantes con filtros múltiples |
| **Calificación** | Lista de participantes elegibles para calificar (CONCLUIDO + CONCLUIDO + ACTIVO) |
| **Ganadores** | Lista de participantes con estado GANADOR + botón entrega de premio |
| **Relatório** | Reporte cruzado de campañas con estados y filtros |
| **Deportes** | Tabla maestra de deportes (listar, agregar, editar) |
| **Região Geográfica** | Tabla maestra de estados/regiones geográficas (listar, agregar, editar) |

---

## 7. Detalle de Tabs del Admin

### Tab Usuarios
- Lista de todos los usuarios registrados
- Columnas: nombre | ciudad | deporte | tipo de cuenta (Freemium/Premium) | estado (ACTIVO / DESHABILITADO)
- Botón **"Deshabilitar"** por fila → cambia estado a DESHABILITADO (el botón desaparece o se desactiva)
- Sin botones de aprobación

### Tab Campañas
- **Reporte** de campañas ordenado por fecha de creación (más recientes primero)
- Columnas visibles: nombre de campaña | deporte | estado de campaña (ABIERTO / CONCLUIDO / ELIMINADO / CALIFICADO)
- Filtros: nombre de campaña | estado de campaña | deporte
- Botón **"Nueva Campaña"** → abre formulario de creación

**Formulario de creación de campaña:**
- Nombre de la campaña
- Deporte (dropdown desde tabla maestra de Deportes)
- Estado geográfico (dropdown desde tabla maestra de Región Geográfica)
- Ciudad
- Fecha de inicio
- Fecha de fin
- Descripción del desafío
- Plan: radio button FREEMIUM / PREMIUM
- Check opcional: "Publicación en Instagram" → si activado, campo de hashtag(s)
- Cantidad de ganadores (numérico)
- Premio por posición (texto)
- Botón: "Publicar campaña"

### Tab Participaciones
- **Reporte** ordenado por fecha de creación de campaña (más recientes primero)
- Columnas: nombre del participante | tipo de cuenta (FREEMIUM/PREMIUM) | nombre de campaña | estado de participación | estado de campaña
- Filtros: nombre de campaña | tipo de cuenta | estado de participación | estado de campaña | deporte
- Botón **"Ver detalhes"** por fila → abre ventana/modal con:
  - Fotos y videos subidos
  - Comentario del participante
  - Fecha de registro en la plataforma
  - Badge IG: ✅ publicó / ❌ no publicó
  - Estado de conclusión automático: CONCLUIDO / NO CONCLUIDO
  - Historial de campañas anteriores

### Tab Calificación
- **Reporte** filtrado automáticamente: solo participantes con estado participación CONCLUIDO + estado campaña CONCLUIDO + estado usuario ACTIVO
- Columnas: nombre del participante | nombre de campaña | fecha de vencimiento de campaña | campos de calificación | total | acciones
- Por cada registro:
  - Botón **"Detalles"** → abre modal con toda la evidencia
  - Campo **Actitud**: número 1–10, permite decimales
  - Campo **Compromiso**: valor fijo 10 (no editable, se muestra automáticamente)
  - Campo **Continuidad**: número 1–10, permite decimales
  - Campo **Total**: suma automática en tiempo real (máx. 30)
  - Al completar Actitud y Continuidad → estado pasa a CALIFICADO automáticamente
  - Botón **"Marcar como ganador"** → estado pasa a GANADOR

### Tab Ganadores
- **Reporte** de participantes con estado GANADOR
- Columnas: nombre del participante | nombre de campaña | mes de creación de la campaña | premio asignado
- Botón **"Premio entregado"** por fila → marca la entrega del premio (cambia estado visual del botón)

### Tab Relatório
- Reporte de todas las campañas con:
  - Nombre de campaña | deporte | ciudad | plan | fechas
  - Estado de participación general de la campaña
  - Estado de premiación: PREMIADO / PENDENTE
- Filtros: estado de participación | estado de premiación | campaña

### Tab Deportes
- Tabla maestra de deportes disponibles en la plataforma
- Columnas: nombre del deporte | estado (activo/inactivo)
- Botón **"Agregar deporte"** → campo de texto + guardar
- Opción de editar o desactivar deportes existentes
- Esta lista se reutiliza en todos los dropdowns de la plataforma

### Tab Região Geográfica
- Tabla maestra de estados/regiones geográficas de Brasil
- Columnas: nombre del estado/región
- Botón **"Agregar región"** → campo de texto + guardar
- Opción de editar o eliminar regiones
- Esta lista se reutiliza en todos los dropdowns de la plataforma

---

## 8. Flujo del Usuario (completo)

```
1. Registro       → correo + contraseña (+ Google login visual)
2. Selección plan → Freemium o Premium
3. Perfil         → nombre, ciudad, país, deporte, foto de perfil
4. Tab Campañas   → ver campañas filtradas por plan + filtro por deporte + filtro por estado geográfico
5. Click "Participar" → estado de participación cambia a EN CURSO
6. Tab Mis Partic.→ ver campaña con estado EN CURSO
7. Subir evidencia → fotos/videos + comentario + checkbox IG
                     (solo si admin aprobó Y campaña ABIERTA)
                     → estado cambia a CONCLUIDO
8. Al cerrar campaña → sistema asigna CONCLUIDO o NO CONCLUIDO automáticamente
9. Tab Notific.   → recibe notificaciones de cambios de estado
10. Tab Mi Perfil → editar datos del perfil en cualquier momento
```

---

## 9. Flujo del Admin (completo)

```
1. Login              → correo admin + contraseña
2. Tab Deportes       → agregar/gestionar tabla maestra de deportes
3. Tab Região Geog.   → agregar/gestionar tabla maestra de regiones
4. Tab Usuarios       → ver lista + deshabilitar usuarios si necesario
5. Tab Campañas       → crear nueva campaña con datos de tablas maestras
6. Tab Participações  → revisar inscripciones con filtros + ver detalle
7. Tab Calificación   → calificar participantes elegibles (CONCLUIDO+CONCLUIDO+ACTIVO)
                        → asignar puntaje Actitud + Continuidad (Compromiso = 10 automático)
                        → marcar ganador → estado GANADOR
8. Tab Ganadores      → ver ganadores + marcar entrega de premios
9. Tab Relatório      → consultar reporte cruzado con filtros
```

---

## 10. Modelo de Negocio

### 10.1 Planes

| | Plan Freemium | Plan Premium |
|---|---|---|
| Precio | R$0 | A definir |
| Campañas exclusivas Freemium | ✅ | ❌ |
| Campañas exclusivas Premium | ❌ | ✅ |
| Rango de premios | R$70 – R$200 | R$200 – R$400 |
| Perfil público + edición | ✅ | ✅ |

> **Nota MVP:** Los pagos automáticos no son necesarios en la primera fase.

### 10.2 Financiamiento de premios
```
Ejemplo base:
100 usuarios Premium × R$X = pool mensual
├── 65% → Premios de campañas
└── 35% → Operación y crecimiento
```

---

## 11. Funcionalidades del Producto (MVP)

### Must Have (v1.0) — Usuario
- [ ] Registro con correo y contraseña / Google login (visual)
- [ ] Selección de plan (Freemium / Premium)
- [ ] Perfil: nombre, ciudad, país, deporte, foto + formulario de edición
- [ ] Tab Campañas: filtro por deporte + filtro por estado geográfico
- [ ] Click "Participar" → cambia estado a EN CURSO (sin formulario de evidencia aquí)
- [ ] Tab Mis Participaciones: estados EN CURSO / CONCLUIDO / NO CONCLUIDO
- [ ] Subida de evidencia: habilitada solo si admin aprobó Y campaña ABIERTA
- [ ] Tab Notificaciones: historial de cambios de estado

### Must Have (v1.0) — Admin
- [ ] Login diferenciado (header verde oscuro + badge ADMIN)
- [ ] Tab Deportes: tabla maestra con CRUD básico
- [ ] Tab Região Geográfica: tabla maestra con CRUD básico
- [ ] Tab Usuarios: lista + estado ACTIVO/DESHABILITADO + botón Deshabilitar
- [ ] Tab Campañas: reporte con filtros + botón Nueva Campaña + formulario con dropdowns de tablas maestras
- [ ] Tab Participaciones: reporte con 5 filtros + botón Ver detalhes
- [ ] Tab Calificación: reporte filtrado automáticamente + campos Actitud/Compromiso(10)/Continuidad/Total + botón Marcar ganador
- [ ] Tab Ganadores: reporte con mes de creación + botón Premio entregado
- [ ] Tab Relatório: reporte cruzado con 3 filtros

### Should Have (v1.5)
- [ ] Notificaciones push / email automáticas
- [ ] Feed público de participaciones
- [ ] Integración real con Google Login
- [ ] Exportación del reporte a Excel/PDF

### Nice to Have (v2.0)
- [ ] App móvil nativa (iOS / Android)
- [ ] Integración con Strava / Apple Health
- [ ] Pagos automáticos de suscripción
- [ ] API para marcas patrocinadoras

---

## 12. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Percepción de favoritismo en calificación | Alta | Criterios numéricos públicos + Compromiso fijo en 10 |
| Usuario confundido por campañas no visibles | Media | Badge de plan visible + mensaje explicativo |
| Baja conversión a Premium | Media | Diferencia clara de rango de premios |
| Pool de premios insuficiente al inicio | Alta | Validar con premios propios antes de escalar |
| Admin desbordado con muchos participantes | Media | Filtros eficientes + calificación estructurada |

---

## 13. Nombre y Branding

**Nombre:** 3BUK  
**Logo:** "3" en verde con rayo amarillo-azul, "buk" en blanco, fondo negro  
**Paleta:**
- Negro: `#000000`
- Verde: `#1A7A2E`
- Amarillo: `#F5C800`
- Azul celeste: `#00AEEF`
- Blanco: `#FFFFFF`

**Tagline:** *"Sua racha é seu mérito."*  
**Hashtag oficial:** `#3bukchallenge` (personalizable por campaña)  
**Tono:** motivador, directo, auténtico — habla de igual a igual con el amateur que se esfuerza.

---

*Versión 1.4 — Estados del sistema definidos, 8 tabs de admin, sistema de calificación numérica, tablas maestras de deportes y regiones geográficas.*