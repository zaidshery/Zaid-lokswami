# Lokswami CMS - Article Creation SOP

Version: 1.0  
Reviewed against the CMS: 4 August 2026  
Audience: Reporter, Copy Editor, Admin, and Super Admin

## 1. Purpose

Use this SOP to create, review, and release a Lokswami article without losing
work or bypassing newsroom checks. The CMS provides two creation paths:

| User | Creation screen | Expected outcome |
| --- | --- | --- |
| Reporter | **Article Create** | Send a short report to the copy desk |
| Copy Editor | **Create Direct Article** | Complete the desk package and submit it for review |
| Admin / Super Admin | **Create Direct Article** | Submit, schedule, or publish a complete article |

Only articles with workflow status **Published** appear on the reader site.
Draft, Submitted, review-stage, and future Scheduled articles remain private.

## 2. Standard workflow

```text
Reporter sends report
        |
        v
Submitted -> Assigned / In Review -> Copy Edit -> Ready for Approval
                                                    |
                                                    v
                                               Approved
                                              /        \
                                       Scheduled     Published
```

- **Changes Requested**: correct the same article and submit it again. Do not
  create a duplicate.
- **Rejected**: the desk has stopped the item. Admin must return it to an
  editable state before work resumes.
- **Archived**: the article is outside the active workflow.

## 3. Reporter: create and send an article

The Reporter screen is intentionally short and mobile-friendly.

1. Sign in and open **Article Create** from the CMS menu or mobile navigation.
2. In **Short title**, enter a clear description of what happened. The maximum
   length is 200 characters.
3. In **Body**, write the complete report. Put a blank line between paragraphs.
4. Under **Images**, choose **Add images** when photographs are available.
   - Multiple images can be selected.
   - The screen does not impose an image-count limit.
   - Wait until **Uploading** disappears before sending.
   - Review every thumbnail and remove any wrong image.
   - The first image becomes the featured image; the remaining images are
     included after the article text.
5. Select **Send to Copy Editor** once.
6. Wait for **Article sent to the copy editor**. The CMS then opens **My Work**.
7. Check the article status and respond to any **Changes Requested** feedback.

The CMS automatically:

- uses the signed-in Reporter's name as author;
- creates a short summary from the article body;
- assigns the temporary category **General**;
- turns off Breaking and Popular News flags; and
- sends the article into **Submitted** status.

The Reporter does not complete SEO, category selection, editorial flags,
publication scheduling, or final publishing. A Copy Editor/Admin finishes those
steps.

### Reporter handoff checklist

- [ ] The title says what happened and where when location matters.
- [ ] Names, spellings, dates, figures, and quotations are verified.
- [ ] The body contains the full report, not only a caption or note.
- [ ] Images match the report and have finished uploading.
- [ ] The first image is suitable as the public featured image.
- [ ] Sensitive source information is not placed in public article copy.
- [ ] **Send to Copy Editor** was selected only once.

Important: the simplified Reporter article screen does not provide a **Save
Draft** action. Finish and send the report before closing or refreshing the
page.

## 4. Copy Editor or Admin: create a full desk article

1. Open **Articles** -> **Create Direct Article**.
2. Complete the **Compose** section:
   - **Article Title**
   - **Summary**
   - **Article Content**
   - **Category**
   - **Staff author**
   - Location Tag, Reporter Notes, and Source Info when applicable
   - **Source is confidential** when source details must remain internal
3. Format the body for readers:
   - use paragraphs for normal copy;
   - use H2/H3 headings to break long articles into sections;
   - use inline images or tables only where they improve understanding; and
   - preview long copy on mobile as well as desktop.
4. Complete editorial quality information:
   - story/evidence type and source attribution;
   - quote attribution when quotations are used;
   - fact-check, legal-review, and sensitivity-review status;
   - headline support and duplicate checks; and
   - AI disclosure and correction note when applicable.
5. Complete **Media**:
   - upload or select a **Featured Image**;
   - confirm the crop/focal point;
   - choose the correct image license; and
   - add featured-image alt text, caption, and credit.
6. Complete **SEO Settings**:
   - SEO Slug
   - Meta Title and Meta Description
   - Focus Keyword and Secondary Keywords
   - Canonical URL only when another canonical page is required
   - News sitemap inclusion when the article qualifies as current news
7. Open **Quality / Readiness** and resolve every blocker before the final
   action.
8. Open **Publish** and choose the permitted final action:
   - **Submit for review**: available to Copy Editor and Admin.
   - **Publish now**: Admin/Super Admin only.
   - **Schedule publication**: Admin/Super Admin only; set **Publish at** using
     the CMS timezone `Asia/Calcutta`.
9. Select the final button once: **Submit for Review**, **Publish Article**, or
   **Schedule Article**.

## 5. Required publication readiness

Before scheduling or publishing, confirm all of the following:

- [ ] Headline is complete and accurate.
- [ ] Summary accurately represents the body.
- [ ] Article body is complete.
- [ ] Category is selected.
- [ ] Staff author is selected.
- [ ] Featured image is attached.
- [ ] Public SEO slug is stable and correct.
- [ ] Sources, quotations, dates, names, and figures are verified.
- [ ] Image alt text, caption, credit, and license are correct.
- [ ] Legal/sensitivity checks are completed when needed.
- [ ] Public preview is checked on mobile and desktop.

The CMS may save an incomplete draft. That does not mean the article is ready
to submit, schedule, or publish.

## 6. Homepage placement flags

### Breaking News / Live Updates

Use only for a current, high-importance event that needs priority in the public
**Live Updates** rail.

1. Enable **Breaking News / Live Updates**.
2. Add a specific **Breaking reason**.
3. Set start and expiry times when the flag is time-bound.
4. Upload and preview the required matching Breaking Audio before publication.
5. Remove or expire the flag when the event is no longer breaking.

### Feature in Popular News

Use when traffic, search, social, or editorial evidence supports priority in
the public **Popular News** rail.

1. Enable **Feature in Popular News**.
2. Record the **Trending reason**.
3. Set **Trending expires at** so the placement does not remain pinned after
   the signal is stale.

Both public rails backfill from published articles. Do not enable a flag merely
to prevent an empty rail.

## 7. Draft safety

- Watch the draft status and wait for **Saved** before leaving the full desk
  form.
- Use `Ctrl+S` or `Cmd+S` before a handoff or long pause.
- Wait for image/audio uploads to finish before submitting or navigating away.
- If **Browser recovery copy available** appears, choose **Restore recovery
  copy** or **Discard old copy** before continuing.
- If a version-conflict warning appears, stop editing, reload the newest saved
  article, and compare changes before retrying.
- Never create a second article to work around an upload, save, or workflow
  error.

## 8. Review, approval, and release

### Copy Editor

1. Open the Submitted article from **Copy Desk** or **My Work**.
2. Claim/accept the assignment and choose **Start Review** when available.
3. Check the report, sources, headline, copy, media, SEO, and accessibility.
4. Save content changes before changing workflow state.
5. Choose **Request Changes** with one actionable reason, or move clean work to
   **Ready For Approval**.

### Admin / Super Admin

1. Open the article in **Ready For Approval**.
2. Review Reporter Notes, Source Info, Copy Editor notes, and activity history.
3. Preview the public presentation on mobile and desktop.
4. Choose **Approve**.
5. Choose **Schedule** or **Publish Now**.
6. After release, open the public URL and verify headline, image, body, audio,
   links, and share preview.
7. Send a push alert only after the public page is confirmed.

## 9. Common problems

| Problem | Correct action |
| --- | --- |
| **Add a short title** | Enter a Reporter title before sending. |
| **Add the article body** | Enter the full report before sending. |
| Images show **Uploading** | Keep the page open and wait; do not send yet. |
| Submit/publish button is disabled | Open Readiness and resolve missing fields, uploads, schedule time, recovery choice, or Breaking Audio. |
| Save reports a conflict | Stop, reload the latest server version, and compare before editing. |
| Article has **Changes Requested** | Edit the same article, address every note, save, and submit again. |
| Public page looks wrong | Do not distribute it. Correct the article, publish the authorized update, and verify again. |

## 10. End-of-task record

Before ending the shift, confirm the article has one clear state and owner:

- Reporter: **Submitted** or actively correcting **Changes Requested**.
- Copy Editor: **In Review**, **Copy Edit**, returned with a reason, or **Ready
  For Approval**.
- Admin: **Approved**, **Scheduled**, **Published**, or returned with a recorded
  reason.

