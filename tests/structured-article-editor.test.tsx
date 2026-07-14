import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StructuredArticleEditor from '@/components/forms/StructuredArticleEditor';

describe('StructuredArticleEditor', () => {
  it('uses a named TipTap textbox with keyboard headings and slash commands', async () => {
    const onChange = vi.fn();
    const onDocumentChange = vi.fn();
    render(
      <StructuredArticleEditor
        value="<p>Desk reporting context</p>"
        onChange={onChange}
        onDocumentChange={onDocumentChange}
      />
    );

    const editor = await screen.findByRole('textbox', { name: 'Article body editor' });
    expect(editor).toHaveAttribute('contenteditable', 'true');

    fireEvent.keyDown(editor, { key: '2', ctrlKey: true, altKey: true });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('<h2>'));
      expect(onDocumentChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'doc', content: expect.any(Array) })
      );
    });

    fireEvent.keyDown(editor, { key: '/' });
    expect(await screen.findByRole('menu', { name: 'Slash commands' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Resource' })).toBeInTheDocument();
  });

  it('provides roving keyboard focus across named toolbar controls', async () => {
    render(<StructuredArticleEditor value="" onChange={vi.fn()} />);
    const toolbar = await screen.findByRole('toolbar', { name: 'Article formatting toolbar' });
    const bold = within(toolbar).getByRole('button', { name: 'Bold' });
    const italic = within(toolbar).getByRole('button', { name: 'Italic' });

    expect(bold).toHaveAttribute('tabindex', '0');
    expect(italic).toHaveAttribute('tabindex', '-1');
    bold.focus();
    fireEvent.keyDown(bold, { key: 'ArrowRight' });
    expect(italic).toHaveFocus();
    expect(italic).toHaveAttribute('tabindex', '0');
  });

  it('inserts a stable editable table through the structured command', async () => {
    const onChange = vi.fn();
    const onOuterSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onOuterSubmit}>
        <StructuredArticleEditor value="<p>Before table</p>" onChange={onChange} />
      </form>
    );
    const insertTable = await screen.findByRole('button', { name: 'Insert table' });
    fireEvent.click(insertTable);

    const dialog = await screen.findByRole('dialog', { name: 'Insert table' });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Table columns' }), {
      target: { value: '2' },
    });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Table rows' }), {
      target: { value: '2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }));

    await waitFor(() => {
      const html = String(onChange.mock.calls.at(-1)?.[0] || '');
      expect(html).toContain('<table');
      expect(html).toContain('<th');
      expect(html).toContain('<td');
    });
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it('keeps insert dialogs keyboard-contained and restores toolbar focus on Escape', async () => {
    render(<StructuredArticleEditor value="" onChange={vi.fn()} />);
    const insertTable = await screen.findByRole('button', { name: 'Insert table' });
    insertTable.focus();
    fireEvent.click(insertTable);

    const dialog = await screen.findByRole('dialog', { name: 'Insert table' });
    await waitFor(() => {
      expect(within(dialog).getByRole('spinbutton', { name: 'Table columns' })).toHaveFocus();
    });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(insertTable).toHaveFocus());
  });
});
