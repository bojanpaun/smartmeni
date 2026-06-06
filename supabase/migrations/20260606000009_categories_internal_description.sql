-- Interni opis kategorije (napomena za admina/osoblje)
--
-- ZAŠTO: admin može objasniti nešto o kategoriji (npr. uputstvo za bar/kuhinju).
-- Vidljivo SAMO u admin panelu — NE prikazuje se gostu u digitalnom meniju.
-- Postojeće RLS politike na categories pokrivaju i novu kolonu (owner-only pristup).

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description TEXT;
