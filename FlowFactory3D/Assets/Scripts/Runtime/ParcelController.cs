using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// The parcel. Moves along a precomputed list of points; no Rigidbody or physics involved.
    /// </summary>
    public sealed class ParcelController : MonoBehaviour
    {
        private const float TurnDegreesPerSecond = 900f;

        private Transform body;

        public void Build()
        {
            body = new GameObject("Body").transform;
            body.SetParent(transform, false);
            Primitives.Create(PrimitiveType.Cube, body, new Vector3(0f, 0.17f, 0f), new Vector3(0.36f, 0.34f, 0.36f), Palette.Parcel, "Box");
            Primitives.Create(PrimitiveType.Cube, body, new Vector3(0f, 0.17f, 0f), new Vector3(0.38f, 0.07f, 0.38f), Palette.ParcelTape, "TapeH");
            Primitives.Create(PrimitiveType.Cube, body, new Vector3(0f, 0.17f, 0f), new Vector3(0.07f, 0.36f, 0.38f), Palette.ParcelTape, "TapeV");
            // A white shipping label with a dark barcode line on the side.
            Primitives.Create(PrimitiveType.Cube, body, new Vector3(0.185f, 0.16f, 0.05f), new Vector3(0.02f, 0.14f, 0.18f), Palette.ParcelLabel, "Label");
            Primitives.Create(PrimitiveType.Cube, body, new Vector3(0.195f, 0.14f, 0.05f), new Vector3(0.02f, 0.03f, 0.13f), Palette.Frame, "Barcode");
        }

        public void PlaceAt(Vector3 position)
        {
            StopAllCoroutines();
            transform.position = position;
            transform.rotation = Quaternion.identity;
            body.localScale = Vector3.one;
            body.localRotation = Quaternion.identity;
            gameObject.SetActive(true);
        }

        public void Hide()
        {
            StopAllCoroutines();
            gameObject.SetActive(false);
        }

        /// <summary>Moves through the points at a constant speed, turning smoothly to face the way it goes.</summary>
        public IEnumerator Travel(IList<Vector3> points, float speed)
        {
            for (int i = 0; i < points.Count; i++)
            {
                Vector3 target = points[i];
                Vector3 flat = target - transform.position;
                flat.y = 0f;
                Quaternion look = flat.sqrMagnitude > 0.0001f ? Quaternion.LookRotation(flat) : transform.rotation;

                while ((transform.position - target).sqrMagnitude > 0.0001f)
                {
                    transform.position = Vector3.MoveTowards(transform.position, target, speed * Time.deltaTime);
                    transform.rotation = Quaternion.RotateTowards(transform.rotation, look, TurnDegreesPerSecond * Time.deltaTime);
                    yield return null;
                }
            }
        }

        /// <summary>Ends a failed run against an obstacle: a short lurch and wobble.</summary>
        public IEnumerator Bump(Vector3 direction)
        {
            Vector3 start = transform.position;
            Vector3 forward = start + direction.normalized * 0.12f;
            yield return MoveOver(start, forward, 0.08f);
            yield return MoveOver(forward, start - direction.normalized * 0.08f, 0.12f);
            for (float t = 0f; t < 0.35f; t += Time.deltaTime)
            {
                body.localRotation = Quaternion.Euler(0f, Mathf.Sin(t * 50f) * 14f * (1f - t / 0.35f), 0f);
                yield return null;
            }
            body.localRotation = Quaternion.identity;
        }

        /// <summary>Ends a failed run that left the board: the parcel tips over the edge and drops.</summary>
        public IEnumerator FallOff(Vector3 direction)
        {
            Vector3 flat = direction.normalized;
            Vector3 start = transform.position;
            for (float t = 0f; t < 0.7f; t += Time.deltaTime)
            {
                transform.position = start + flat * (t * 0.9f) + Vector3.down * (t * t * 7f);
                body.localRotation = Quaternion.AngleAxis(t * 260f, Vector3.Cross(Vector3.up, flat));
                yield return null;
            }
        }

        /// <summary>Success: slide to the middle of the bin and shrink into it.</summary>
        public IEnumerator Deliver(Vector3 center)
        {
            yield return MoveOver(transform.position, center, 0.18f);
            for (float t = 0f; t < 0.3f; t += Time.deltaTime)
            {
                float k = 1f - t / 0.3f;
                body.localScale = Vector3.one * k;
                transform.position = center + Vector3.down * (0.18f * (1f - k));
                yield return null;
            }
            body.localScale = Vector3.zero;
        }

        private IEnumerator MoveOver(Vector3 from, Vector3 to, float seconds)
        {
            for (float t = 0f; t < seconds; t += Time.deltaTime)
            {
                transform.position = Vector3.Lerp(from, to, t / seconds);
                yield return null;
            }
            transform.position = to;
        }
    }
}
