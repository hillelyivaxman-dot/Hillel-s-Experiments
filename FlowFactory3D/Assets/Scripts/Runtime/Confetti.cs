using System.Collections;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>A short burst of coloured paper squares when a parcel is delivered. Primitives only, no particle system.</summary>
    public sealed class Confetti : MonoBehaviour
    {
        private static readonly Color[] Colors =
        {
            new Color(1.00f, 0.80f, 0.20f), new Color(0.95f, 0.40f, 0.35f), new Color(0.25f, 0.80f, 0.65f),
            new Color(0.35f, 0.65f, 0.95f), new Color(0.98f, 0.92f, 0.82f)
        };

        public void Burst(Vector3 origin)
        {
            StartCoroutine(GlowRing(origin));
            for (int i = 0; i < 28; i++)
            {
                StartCoroutine(Piece(origin));
            }
        }

        /// <summary>A golden light pulse that expands and fades on the floor where the parcel arrived.</summary>
        private IEnumerator GlowRing(Vector3 origin)
        {
            Material shared = GameMaterials.GetBlobShadow();
            if (shared == null) yield break;

            var material = new Material(shared);
            GameObject ring = Primitives.Create(PrimitiveType.Quad, transform, new Vector3(origin.x, 0.13f, origin.z), Vector3.one * 0.5f,
                material, Quaternion.Euler(90f, 0f, 0f), "GlowRing");
            const float life = 0.8f;
            for (float t = 0f; t < life; t += Time.deltaTime)
            {
                float k = t / life;
                float size = Mathf.Lerp(0.6f, 3.6f, 1f - (1f - k) * (1f - k));
                ring.transform.localScale = new Vector3(size, size, 1f);
                material.SetColor("_Color", new Color(1f, 0.85f, 0.35f, 0.85f * (1f - k)));
                yield return null;
            }
            Destroy(ring);
            Destroy(material);
        }

        public void Clear()
        {
            StopAllCoroutines();
            foreach (Transform child in transform)
            {
                Destroy(child.gameObject);
            }
        }

        private IEnumerator Piece(Vector3 origin)
        {
            GameObject piece = Primitives.Create(PrimitiveType.Cube, transform, origin, new Vector3(0.09f, 0.02f, 0.06f),
                Colors[Random.Range(0, Colors.Length)], "Confetti");
            Vector3 velocity = new Vector3(Random.Range(-1.6f, 1.6f), Random.Range(2.6f, 4.4f), Random.Range(-1.6f, 1.6f));
            Vector3 spin = new Vector3(Random.Range(-540f, 540f), Random.Range(-540f, 540f), Random.Range(-540f, 540f));
            const float life = 1.3f;
            for (float t = 0f; t < life; t += Time.deltaTime)
            {
                velocity += Vector3.down * (9f * Time.deltaTime);
                piece.transform.position += velocity * Time.deltaTime;
                piece.transform.Rotate(spin * Time.deltaTime);
                piece.transform.localScale = new Vector3(0.09f, 0.02f, 0.06f) * Mathf.Clamp01((life - t) / 0.4f);
                yield return null;
            }
            Destroy(piece);
        }
    }
}
