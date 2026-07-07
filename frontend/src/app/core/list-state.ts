/** Client-side filter + sort + pagination helper shared by all list pages. */
export class ListState<T extends Record<string, any>> {
  search = '';
  sortKey = '';
  sortDir: 1 | -1 = 1;
  page = 1;
  pageSize = 10;

  sortBy(key: string): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 1 ? -1 : 1;
    } else {
      this.sortKey = key;
      this.sortDir = 1;
    }
  }

  apply(rows: T[]): T[] {
    let out = rows;
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      out = out.filter((r) =>
        Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(q))
      );
    }
    if (this.sortKey) {
      const k = this.sortKey;
      out = [...out].sort((a, b) => {
        const av = a[k] ?? '';
        const bv = b[k] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * this.sortDir;
        return String(av).localeCompare(String(bv)) * this.sortDir;
      });
    }
    return out;
  }

  pageOf(rows: T[]): T[] {
    const filtered = this.apply(rows);
    const pages = this.pages(rows);
    if (this.page > pages) this.page = pages;
    return filtered.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
  }

  pages(rows: T[]): number {
    return Math.max(1, Math.ceil(this.apply(rows).length / this.pageSize));
  }

  count(rows: T[]): number {
    return this.apply(rows).length;
  }
}
