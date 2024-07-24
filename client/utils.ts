export function CFV(field_id: number): JQuery<HTMLElement> {
  return $(`input[name="CFV[${field_id}]"]`);
}

export const BACKEND_BASE_URL = process.env.BACKEND_BASE;
