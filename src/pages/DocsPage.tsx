import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Link } from "wasp/client/router";
import { SearchIcon } from "../components/builder/icons";
import { inputClasses } from "../shared/styles";
import {
  ARTICLE_INDEX,
  categoryLabel,
  WIKI_ARTICLES,
  WIKI_CATEGORIES,
} from "../wiki/articles";

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("article");
  const activeArticle = ARTICLE_INDEX.has(requested ?? "")
    ? (requested as string)
    : WIKI_ARTICLES[0].id;
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return WIKI_ARTICLES;
    }
    return WIKI_ARTICLES.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.id.includes(query),
    );
  }, [search]);

  const article = ARTICLE_INDEX.get(activeArticle);
  const articleIndex = WIKI_ARTICLES.findIndex(
    (candidate) => candidate.id === activeArticle,
  );
  const previous = articleIndex > 0 ? WIKI_ARTICLES[articleIndex - 1] : null;
  const next =
    articleIndex >= 0 && articleIndex < WIKI_ARTICLES.length - 1
      ? WIKI_ARTICLES[articleIndex + 1]
      : null;

  function navigateTo(articleId: string) {
    setSearchParams({ article: articleId });
  }

  const groups = WIKI_CATEGORIES.map((category) => ({
    ...category,
    articles: filtered.filter((item) => item.category === category.id),
  }));

  const categoriesWithArticles = groups.filter(
    (group) => group.articles.length > 0,
  );

  return (
    <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-6 px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Documentation
          </span>
          <h1 className="font-display text-[clamp(28px,3.2vw,36px)] font-bold leading-tight tracking-[-0.028em] text-neutral-900">
            Form Builder wiki
          </h1>
          <p className="max-w-[60ch] text-sm leading-relaxed text-neutral-500">
            Every setting explained, with examples. Advanced controls in the
            builder show a{" "}
            <span className="inline-flex size-4.5 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-bold text-neutral-500">
              ?
            </span>{" "}
            bubble that links straight to the relevant page.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="sticky top-20 flex flex-col gap-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the wiki..."
                aria-label="Search the wiki"
                className={`${inputClasses} py-2 pl-9`}
              />
            </div>

            <nav aria-label="Wiki" className="flex flex-col gap-4">
              {categoriesWithArticles.map((group) => (
                <div key={group.id} className="flex flex-col gap-1">
                  <span className="px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    {group.label}
                  </span>
                  <ul className="flex flex-col gap-0.5">
                    {group.articles.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => navigateTo(item.id)}
                          aria-current={
                            item.id === activeArticle ? "page" : undefined
                          }
                          className={`w-full rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                            item.id === activeArticle
                              ? "bg-primary-50 font-semibold text-primary-700"
                              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
                          }`}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 text-[13px] text-neutral-500">
                  No articles match your search.
                </p>
              )}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {article ? (
            <article className="card p-6 lg:p-10">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  {categoryLabel(article.category)}
                </span>
                <h2 className="font-display text-3xl font-bold tracking-[-0.028em] text-neutral-900">
                  {article.title}
                </h2>
                <p className="max-w-[70ch] text-[14px] leading-relaxed text-neutral-500">
                  {article.summary}
                </p>
              </div>
              <div className="mt-5 border-t border-neutral-100 pt-5">
                {article.content}
              </div>

              {(previous || next) && (
                <div className="mt-10 flex flex-col justify-between gap-3 border-t border-neutral-100 pt-5 sm:flex-row">
                  {previous ? (
                    <Link
                      to="/docs"
                      search={{ article: previous.id }}
                      className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-neutral-200 px-3 py-2 transition-colors hover:border-primary-300 hover:bg-primary-50"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                        Previous
                      </span>
                      <span className="truncate text-[13px] font-semibold text-neutral-800">
                        {previous.title}
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <Link
                      to="/docs"
                      search={{ article: next.id }}
                      className="flex min-w-0 flex-col items-end gap-0.5 rounded-lg border border-neutral-200 px-3 py-2 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                        Next
                      </span>
                      <span className="truncate text-[13px] font-semibold text-neutral-800">
                        {next.title}
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </article>
          ) : (
            <div className="card p-10 text-neutral-500">
              Article not found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
