-- 0050_review_comments_author_edit_delete.sql — let a comment's AUTHOR edit or
-- delete their OWN comment (0046 shipped append-only + owner-resolve only).
--
-- • edit   — the author may change only the BODY of their own comment, and only
--            while it is open (status stays 'open', authorship pinned to self so a
--            comment can't be re-homed or re-authored). Resolving stays the owner's
--            action (0046 review_comments_owner_update).
-- • delete — author-only, any status.
-- Both mirror the 0046 party resolver (SECURITY DEFINER, fail-closed). Permissive
-- policies sit alongside the existing owner_update, so resolve still works.

grant delete on public.review_comments to web_app_user;

-- UPDATE — the author edits their own OPEN comment's body.
drop policy if exists review_comments_author_update on public.review_comments;
create policy review_comments_author_update on public.review_comments for update
  using (
    author_user_id = public.app_current_user_id()
    and public.review_comment_is_party(entity_type, entity_id)
  )
  with check (
    author_user_id = public.app_current_user_id()
    and author_org_id = public.app_current_org()
    and status = 'open'
    and public.review_comment_is_party(entity_type, entity_id)
  );

-- DELETE — the author removes their own comment.
drop policy if exists review_comments_author_delete on public.review_comments;
create policy review_comments_author_delete on public.review_comments for delete
  using (
    author_user_id = public.app_current_user_id()
    and public.review_comment_is_party(entity_type, entity_id)
  );
