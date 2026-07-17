import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OperationsCenterTabs from '@/components/admin/OperationsCenterTabs';

const tabs = [
  { id: 'decisions', label: 'Decisions', description: 'Release calls', content: createElement('p', null, 'Decision content') },
  { id: 'risks', label: 'Risks', description: 'Operational risk', content: createElement('p', null, 'Risk content') },
  { id: 'quality', label: 'Quality', description: 'Quality review', content: createElement('p', null, 'Quality content') },
];

describe('OperationsCenterTabs', () => {
  it('exposes an accessible tab interface and switches panels by click', () => {
    render(createElement(OperationsCenterTabs, { tabs }));

    expect(screen.getByRole('tab', { name: /decisions/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /risks/i }));

    expect(screen.getByRole('tab', { name: /risks/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Risk content');
  });

  it('supports arrow-key navigation without leaving the tab list', () => {
    render(createElement(OperationsCenterTabs, { tabs }));

    const decisionsTab = screen.getByRole('tab', { name: /decisions/i });
    decisionsTab.focus();
    fireEvent.keyDown(decisionsTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /risks/i })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Risk content');
  });
});
