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
