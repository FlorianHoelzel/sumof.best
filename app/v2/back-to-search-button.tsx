"use client";

const FOCUS_SEARCH_EVENT = "sum-of-best:focus-search";

export default function BackToSearchButton() {
  return (
    <footer className="v2-build-own">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))}
      >
        <span>Build your own archive</span>
        <b aria-hidden="true">↑</b>
      </button>
    </footer>
  );
}
