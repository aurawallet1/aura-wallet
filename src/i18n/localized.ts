type StringTree = { [key: string]: string | StringTree };

const mergeTrees = (base: StringTree, override: StringTree): StringTree => {
  const result: StringTree = { ...base };
  for (const key of Object.keys(override)) {
    const baseValue = base[key];
    const overrideValue = override[key];
    if (
      baseValue &&
      typeof baseValue === 'object' &&
      overrideValue &&
      typeof overrideValue === 'object'
    ) {
      result[key] = mergeTrees(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }
  return result;
};

class Strings<T extends object> {
  private tables: Record<string, T>;

  private base: T;

  private current: string;

  public constructor(tables: Record<string, T>) {
    this.tables = tables;
    const first = Object.keys(tables)[0] ?? 'en';
    this.base = tables.en ?? tables[first];
    this.current = first;
    this.apply();
  }

  private apply(): void {
    const active = this.tables[this.current] ?? this.base;
    const merged = mergeTrees(this.base as StringTree, active as StringTree);
    for (const key of Object.keys(this.base as StringTree)) {
      (this as unknown as StringTree)[key] = merged[key];
    }
  }

  public setContent(tables: Record<string, T>): void {
    this.tables = tables;
    const first = Object.keys(tables)[0] ?? this.current;
    this.base = tables.en ?? tables[first];
    if (!this.tables[this.current]) {
      this.current = first;
    }
    this.apply();
  }

  public setLanguage(code: string): void {
    if (this.tables[code]) {
      this.current = code;
    }
    this.apply();
  }

  public getLanguage(): string {
    return this.current;
  }

  public formatString(
    template: string,
    ...values: (string | number | object)[]
  ): string {
    let result = String(template);
    values.forEach((value, index) => {
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of Object.keys(record)) {
          result = result.split('{' + key + '}').join(String(record[key]));
        }
      } else {
        result = result.split('{' + index + '}').join(String(value));
      }
    });
    return result;
  }
}

export type LocalizedStrings<T extends object> = Strings<T> & T;

export default Strings;
