import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SentimentBadge } from "../SentimentBadge";

describe("SentimentBadge", () => {
  it("renders positive sentiment", () => {
    render(<SentimentBadge sentiment="positive" />);
    expect(screen.getByText("positive")).toBeInTheDocument();
  });

  it("renders neutral sentiment", () => {
    render(<SentimentBadge sentiment="neutral" />);
    expect(screen.getByText("neutral")).toBeInTheDocument();
  });

  it("renders negative sentiment", () => {
    render(<SentimentBadge sentiment="negative" />);
    expect(screen.getByText("negative")).toBeInTheDocument();
  });

  it("renders score when provided", () => {
    render(<SentimentBadge sentiment="positive" score={0.85} />);
    expect(screen.getByText(/positive/)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.85/)).toBeInTheDocument();
  });
});
