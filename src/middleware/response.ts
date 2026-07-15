// API 응답 헬퍼
export const ok = <T>(data: T, message?: string) => ({
  success: true,
  ...(message && { message }),
  data
})

export const fail = (error: string, data?: Record<string, unknown>) => ({
  success: false,
  error,
  ...(data && { data })
})

export const paginate = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) => ({
  success: true,
  data,
  pagination: {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    has_next: page * limit < total
  }
})

export const parsePagination = (
  page?: string | null,
  limit?: string | null,
  maxLimit = 100
): { page: number; limit: number; offset: number } => {
  const p = Math.max(1, parseInt(page || '1', 10))
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit || '20', 10)))
  return { page: p, limit: l, offset: (p - 1) * l }
}
