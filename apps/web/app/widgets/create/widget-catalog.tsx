'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type CatalogItem = readonly [string, string, string, string, string, string, boolean?];

const categories = ['Todos', 'Alertas', 'Arrecadação', 'Comunidade', 'Informação', 'Mídia', 'Interação'];

export function WidgetCatalog({ items }: { items: readonly CatalogItem[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const visible = useMemo(() => items.filter(([, name, description, , itemCategory]) =>
    (category === 'Todos' || category === itemCategory) &&
    `${name} ${description}`.toLowerCase().includes(search.trim().toLowerCase())), [items, search, category]);

  return (
    <section className="widget-catalog">
      <div className="widget-catalog-toolbar">
        <label><span>Buscar widget</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: meta, música ou ranking" /></label>
        <div className="ui-tabs" role="tablist" aria-label="Categorias">
          {categories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </div>
      <div className="widget-type-grid">
        {visible.map(([type, name, description, behavior, , sourceMode, recommended]) => (
          <article className="widget-type-card" key={type}>
            <div className={`widget-type-icon type-${type.toLowerCase()}`}>◇</div>
            <div className="widget-catalog-badges"><span className="widget-behavior">{behavior}</span>{recommended ? <span className="status-badge success">Recomendado</span> : null}</div>
            <h2>{name}</h2>
            <p>{description}</p>
            <small>{sourceMode}</small>
            <Link className="primary-button button-link" href={`/widgets/create?type=${type}`}>Adicionar</Link>
          </article>
        ))}
      </div>
      {!visible.length ? <div className="empty-state"><span>◇</span><h2>Nenhum widget encontrado</h2><p>Tente outro nome ou escolha uma categoria diferente.</p></div> : null}
    </section>
  );
}
