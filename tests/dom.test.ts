import { describe, it, expect } from 'vitest';
import { parsePrompt } from '../src/utils/isomorphic/dom';

describe('parsePrompt', () => {
  it('should parse prompt with attributes', () => {
    const prompt = 'A button labeled "Search" Attributes: {"ref":"e83","type":"button"}';
    const result = parsePrompt(prompt);
    expect(result).toEqual({ ref: 'e83', type: 'button' });
  });

  it('should return empty object for prompt without attributes', () => {
    const prompt = 'A button labeled "Search"';
    const result = parsePrompt(prompt);
    expect(result).toEqual({});
  });

  it('should return empty object for invalid JSON in attributes', () => {
    const prompt = 'A button Attributes: {invalid json}';
    const result = parsePrompt(prompt);
    expect(result).toEqual({});
  });

  it('should handle multiple attributes', () => {
    const prompt = 'Input field Attributes: {"ref":"e1","type":"text","placeholder":"Search"}';
    const result = parsePrompt(prompt);
    expect(result).toEqual({
      ref: 'e1',
      type: 'text',
      placeholder: 'Search',
    });
  });
});
