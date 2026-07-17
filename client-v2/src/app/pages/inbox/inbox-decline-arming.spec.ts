import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InboxProjectComponent } from './inbox-project.component';
import { InboxReplyBody, InboxService, InboxThreadItem } from '../../core/inbox/inbox.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { AuthService } from '../../core/auth/auth.service';

/**
 * ARMED-STATE HYGIENE — regression guard for audit 2026-07-17 B1.
 *
 * `decline()` arms `decliningId` and seeds the compose box; the NEXT send() posts
 * the decline. Originally only send()/selectThread()/selectItem() cleared it, so a
 * user who clicked Decline, changed their mind and clicked Request Information (or
 * Accept, or Suggest New Cost) still declined the line on their next message —
 * silently, because Request Info OVERWRITES the seeded reason text, removing the
 * only clue.
 *
 * The rule these tests defend: any action that supersedes Decline must disarm it.
 * If a new action is added to the item action bar, add it here too.
 */

const ITEM = { id: 'pi-1', itemId: 'cat-1', name: 'Sit-Down Dinner', priceCurrent: 1200, priceRef: 1200 } as InboxThreadItem;

/** Captures what the component actually posts, so we assert the WIRE, not just state. */
let sent: { threadId: string; body: InboxReplyBody }[] = [];

function makeComponent(viewer: 'supplier' | 'agency' = 'supplier') {
  sent = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: InboxService,
        useValue: {
          // projectId is '' in the test, so the resource stays idle and never calls this.
          projectInbox: () => of({ project: null, threads: [] }),
          reply: (threadId: string, body: InboxReplyBody) => {
            sent.push({ threadId, body });
            return of({ ok: true, replyId: 'r1', changes: [] });
          },
        },
      },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
      { provide: PageConfigService, useValue: { eventLabel: () => 'Event' } },
      { provide: AuthService, useValue: { user: () => ({ displayName: 'Tester', email: 't@t' }) } },
    ],
  });
  const fixture = TestBed.createComponent(InboxProjectComponent);
  fixture.componentRef.setInput('viewer', viewer);
  // Deliberately NO detectChanges(): this is a logic test of the arm/disarm rule,
  // and rendering would drag in the page hero's Lucide icon registry for nothing.
  // Methods/signals under test are `protected` (template-only surface).
  return fixture.componentInstance as unknown as {
    decline(it: InboxThreadItem): void;
    accept(it: InboxThreadItem): void;
    startPropose(it: InboxThreadItem): void;
    requestInfo(it: InboxThreadItem): void;
    send(threadId: string): Promise<void>;
    decliningId: { (): string | null; set(v: string | null): void };
    draft: { (): string; set(v: string): void };
  };
}

describe('inbox — decline arming (audit B1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('decline() arms the pending decline and seeds a reason stem', () => {
    const c = makeComponent();
    c.decline(ITEM);
    expect(c.decliningId()).toBe('pi-1');
    expect(c.draft()).toContain('Decline because');
  });

  it('agent sees "Cancel" wording in the seeded stem', () => {
    const c = makeComponent('agency');
    c.decline(ITEM);
    expect(c.draft()).toContain('Cancel because');
  });

  // The three supersede paths — each one is a real "changed my mind" click.
  it('requestInfo() disarms the pending decline', () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.requestInfo(ITEM);
    expect(c.decliningId()).toBeNull();
  });

  it('accept() disarms the pending decline', () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.accept(ITEM);
    expect(c.decliningId()).toBeNull();
  });

  it('startPropose() disarms the pending decline', () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.startPropose(ITEM);
    expect(c.decliningId()).toBeNull();
  });

  it('an armed decline DOES post the decline action on send', async () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.draft.set('Sit-Down Dinner — Decline because out of stock');
    await c.send('thread-1');
    expect(sent).toHaveLength(1);
    expect(sent[0].body.itemActions).toEqual([{ itemId: 'pi-1', action: 'decline' }]);
  });

  // THE BUG: Decline → Request Info → type a question → Send used to decline the
  // item. The message must go as plain chat, with no item action at all.
  it('Decline → Request Info → Send sends a plain message and does NOT decline', async () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.requestInfo(ITEM);
    c.draft.set("what's the lead time?");
    await c.send('thread-1');
    expect(sent).toHaveLength(1);
    expect(sent[0].body.itemActions).toBeUndefined();
    expect(sent[0].body.text).toBe("what's the lead time?");
  });

  it('Decline → Accept → Send sends a plain message and does NOT re-decline', async () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.accept(ITEM); // posts its own accept reply
    sent = [];
    c.draft.set('happy to proceed, thanks');
    await c.send('thread-1');
    expect(sent).toHaveLength(1);
    expect(sent[0].body.itemActions).toBeUndefined();
  });

  it('send() disarms, so a follow-up message never re-declines', async () => {
    const c = makeComponent();
    c.decline(ITEM);
    c.draft.set('Decline because out of stock');
    await c.send('thread-1');
    expect(c.decliningId()).toBeNull();

    sent = [];
    c.draft.set('anything else you need?');
    await c.send('thread-1');
    expect(sent[0].body.itemActions).toBeUndefined();
  });
});
