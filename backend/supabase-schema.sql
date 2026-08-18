-- ============================================================
-- Esquema de Supabase para "Despacho" (reemplaza a Firestore)
-- ============================================================
-- Cómo usarlo: en tu proyecto de Supabase, ve a "SQL Editor" →
-- "New query", pega TODO este archivo, y dale "Run". Se corre
-- una sola vez; ya crea todo lo que la app necesita.

-- --- Tabla de usuarios (antes: colección "usuarios") ---
-- El id es el "sub" que entrega Google al iniciar sesión.
create table if not exists usuarios (
  id      text primary key,
  nombre  text,
  correo  text,
  rol     text check (rol in ('vendedor', 'almacenero'))
);

-- --- Tabla de pedidos (antes: colección "pedidos") ---
create table if not exists pedidos (
  id                  text primary key,           -- "PED-0001"
  cliente             text not null,
  vendedor_id         text not null,
  vendedor_nombre     text,
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente', 'tomado', 'finalizado')),
  tipo                text check (tipo in ('separar', 'confirmar')),
  items               jsonb not null default '[]'::jsonb,
  foto                text,                        -- foto en base64 (puede ser grande)
  -- columna calculada: evita tener que leer la foto solo para saber si
  -- existe, cuando se lista el pedido sin la foto (más liviano).
  tiene_foto          boolean generated always as (foto is not null) stored,
  creado_en           bigint not null,              -- epoch ms, igual que antes
  visto_por_vendedor  boolean not null default true,
  almacenero_id       text,
  almacenero_nombre   text,
  tomado_en           bigint,
  cajas               integer,
  finalizado_en       bigint
);

create index if not exists idx_pedidos_vendedor_id on pedidos (vendedor_id);
create index if not exists idx_pedidos_creado_en on pedidos (creado_en desc);

-- --- Tabla de chats (antes: colección "chats", 1 doc por pedido) ---
create table if not exists chats (
  pedido_id  text primary key references pedidos (id) on delete cascade,
  mensajes   jsonb not null default '[]'::jsonb
);

-- --- Generador de IDs correlativos "PED-0001", "PED-0002", ... ---
-- (antes: colección "meta" + transacción de Firestore). Una secuencia de
-- Postgres ya es atómica de por sí, así que no hace falta transacción.
create sequence if not exists pedidos_id_seq;

create or replace function siguiente_pedido_id()
returns text
language sql
as $$
  select 'PED-' || lpad(nextval('pedidos_id_seq')::text, 4, '0');
$$;

-- ============================================================
-- Seguridad: este backend usa la Service Role Key (acceso total,
-- se salta Row Level Security), igual que antes el Admin SDK de
-- Firebase se saltaba las reglas de Firestore. Por eso NO hace
-- falta activar RLS ni escribir políticas — el control de acceso
-- lo sigue haciendo el backend (Express), no Supabase.
-- ============================================================

-- ============================================================
-- MIGRACIÓN: soporte para varias fotos por pedido
-- ============================================================
-- Antes cada pedido tenía una sola foto (columna "foto", texto).
-- Ahora un pedido puede tener varias, guardadas en la columna
-- nueva "fotos" (una lista en formato JSON: [{ "id": "...", "src": "..." }]).
--
-- Cómo usarlo: en tu proyecto de Supabase, ve a "SQL Editor" →
-- "New query", pega SOLO este bloque (puedes pegarlo también junto
-- con todo el archivo, es seguro volver a correrlo) y dale "Run".
-- La columna "foto" antigua NO se borra, así que los pedidos que
-- ya existían siguen mostrando su foto de siempre.

alter table pedidos add column if not exists fotos jsonb not null default '[]'::jsonb;

-- La columna calculada "tiene_foto" ahora debe considerar tanto la
-- foto antigua como el arreglo nuevo. Como es una columna generada,
-- hay que borrarla y volver a crearla (no se puede solo "alterar").
alter table pedidos drop column if exists tiene_foto;
alter table pedidos add column tiene_foto boolean generated always as (
  (foto is not null) or (jsonb_array_length(fotos) > 0)
) stored;

-- ============================================================
-- MIGRACIÓN: cancelar pedido, historial de ediciones, y anclar pedidos
-- ============================================================
-- Igual que los bloques anteriores: pégalo en el SQL Editor de Supabase
-- y dale "Run". Es seguro volver a correrlo, no borra nada existente.

-- "cancelado" como nuevo estado posible (antes solo pendiente/tomado/finalizado)
alter table pedidos drop constraint if exists pedidos_estado_check;
alter table pedidos add constraint pedidos_estado_check
  check (estado in ('pendiente', 'tomado', 'finalizado', 'cancelado'));
alter table pedidos add column if not exists cancelado_en bigint;

-- Historial de ediciones hechas por el almacenero DESPUÉS de finalizar
-- el pedido: [{ id, ts, autor, descripcion }, ...]
alter table pedidos add column if not exists historial jsonb not null default '[]'::jsonb;

-- Pedidos anclados (fijados arriba de la lista, para todos)
alter table pedidos add column if not exists anclado boolean not null default false;
create index if not exists idx_pedidos_anclado on pedidos (anclado desc, creado_en desc);

-- ============================================================
-- MIGRACIÓN: notificaciones (pedido nuevo, mensajes de chat nuevos)
-- ============================================================
-- Igual que los bloques anteriores: pégalo en el SQL Editor de Supabase
-- y dale "Run". Seguro de volver a correr.

-- El almacén ve un aviso de "pedido nuevo" hasta que alguien lo abre.
alter table pedidos add column if not exists visto_por_almacen boolean not null default false;
-- Los pedidos que ya existían no necesitan mostrar el aviso retroactivo.
update pedidos set visto_por_almacen = true where visto_por_almacen = false and estado <> 'pendiente';

-- Quién mandó el último mensaje de chat, y si cada lado ya lo vio.
alter table pedidos add column if not exists ultimo_mensaje_en bigint;
alter table pedidos add column if not exists ultimo_mensaje_autor_rol text;
alter table pedidos add column if not exists chat_visto_vendedor boolean not null default true;
alter table pedidos add column if not exists chat_visto_almacen boolean not null default true;

-- ============================================================
-- MIGRACIÓN: notificaciones push reales (funcionan con el navegador
-- cerrado, como las de una app de mensajería o las ofertas de una tienda)
-- ============================================================
-- Guarda, por dispositivo/navegador suscrito, los datos que hacen falta
-- para poder mandarle un push más adelante.
create table if not exists push_subscriptions (
  endpoint   text primary key,
  user_id    text not null,
  rol        text,
  p256dh     text not null,
  auth       text not null,
  creado_en  timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);
create index if not exists idx_push_subscriptions_rol on push_subscriptions (rol);
