import { useEffect, useMemo, useState } from "react";

export function usePagination(data = [], pageSize = 25) {
  const safeData = Array.isArray(data) ? data : [];

  // Chakra Pagination is 1-based
  const [page, setPage] = useState(1);

  const totalItems = safeData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // keep page valid when filters/search shrink data
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return safeData.slice(start, start + pageSize);
  }, [safeData, page, pageSize]);

  return {
    page,
    setPage,
    pageSize,
    totalItems,
    totalPages,
    pageData,
  };
}
