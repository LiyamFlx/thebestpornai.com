-- Remove 9 test-upload rows accidentally created during upload verification.
-- These are in the uploads table only; the 807 seed videos live in catalog.js and are untouched.
delete from uploads where id in (
  '73b09dbf-aabc-4df0-aa32-d7a948665418',
  '5dbf8547-5c05-4661-99ce-2c3cc87469f6',
  '6d8596fd-fdf2-4400-b4fe-1051d718e889',
  'bdc15d1b-8461-42b5-83f9-1584eefb81b0',
  '9f4ebe77-fe14-430c-b151-85847371e5f1',
  'c0b782c0-a71e-4b15-8c79-76963b7340bc',
  '0fd6faa3-e6ea-413b-aa52-34c56f40e26f',
  'fc74307d-0b2c-4e95-84ab-d16c1b5a05fb',
  '4fd09a1a-48ce-455a-9baf-d262b0c52bd7'
);
