import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CmsWorkflowPriorityBadge,
  CmsWorkflowStatusBadge,
  formatWorkflowContentTypeLabel,
  formatWorkflowPriorityLabel,
  formatWorkflowStatusLabel,
  getWorkflowPriorityToneClass,
  getWorkflowStatusToneClass,
} from '@/components/admin/CmsWorkflowStatusBadge';

describe('CMS workflow status badge', () => {
  it('formats workflow and production labels consistently', () => {
    expect(formatWorkflowStatusLabel('ready_for_approval')).toBe('Ready For Approval');
    expect(formatWorkflowStatusLabel('qa_review')).toBe('Qa Review');
    expect(formatWorkflowContentTypeLabel('epaper')).toBe('E-Paper');
    expect(formatWorkflowContentTypeLabel('epaperArticle')).toBe('E-Paper Article');
    expect(formatWorkflowPriorityLabel('urgent')).toBe('Urgent');
    expect(formatWorkflowPriorityLabel(undefined)).toBe('Normal');
  });

  it('uses shared tone classes for active workflow states', () => {
    expect(getWorkflowStatusToneClass('published')).toContain('emerald');
    expect(getWorkflowStatusToneClass('in_review')).toContain('amber');
    expect(getWorkflowStatusToneClass('rejected')).toContain('red');
    expect(getWorkflowPriorityToneClass('urgent')).toContain('red');
    expect(getWorkflowPriorityToneClass('high')).toContain('amber');
    expect(getWorkflowPriorityToneClass('normal')).toContain('blue');
    expect(getWorkflowPriorityToneClass('Urgent')).toContain('red');
  });

  it('renders a semantic status label for admin queue surfaces', () => {
    render(<CmsWorkflowStatusBadge status="copy_edit" />);

    expect(screen.getByText('Copy Edit')).toBeInTheDocument();
  });

  it('renders priority labels with optional queue prefix', () => {
    render(<CmsWorkflowPriorityBadge priority="urgent" showPrefix />);

    expect(screen.getByText('Priority Urgent')).toBeInTheDocument();
  });
});
