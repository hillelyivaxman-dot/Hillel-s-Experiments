using System.Collections;
using UnityEngine;

namespace FlowFactory
{
    /// <summary>
    /// Short, skippable animation for the last level: a small factory pops up next to the board,
    /// its windows light up and smoke rises. Primitives only.
    /// </summary>
    public sealed class FactoryAwakening : MonoBehaviour
    {
        public bool SkipRequested;

        /// <summary>Removes the factory and any smoke (called when a level is left or restarted).</summary>
        public void Clear()
        {
            StopAllCoroutines();
            foreach (Transform child in transform)
            {
                Destroy(child.gameObject);
            }
        }

        public IEnumerator Play(Vector3 position)
        {
            SkipRequested = false;
            var root = new GameObject("Factory").transform;
            root.SetParent(transform, false);
            root.position = position;
            root.localScale = Vector3.zero;

            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, 0.45f, 0f), new Vector3(2.2f, 0.9f, 1.4f), new Color(0.62f, 0.66f, 0.74f), "Hall");
            Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, 1.0f, 0f), new Vector3(2.3f, 0.2f, 1.5f), new Color(0.78f, 0.28f, 0.22f), "Roof");
            Primitives.Create(PrimitiveType.Cylinder, root, new Vector3(0.7f, 1.55f, 0.25f), new Vector3(0.38f, 0.65f, 0.38f), new Color(0.45f, 0.30f, 0.26f), "Chimney");
            var lamps = new[]
            {
                Primitives.Create(PrimitiveType.Cube, root, new Vector3(-0.65f, 0.55f, -0.72f), new Vector3(0.38f, 0.30f, 0.05f), new Color(0.25f, 0.28f, 0.33f), "Window"),
                Primitives.Create(PrimitiveType.Cube, root, new Vector3(0f, 0.55f, -0.72f), new Vector3(0.38f, 0.30f, 0.05f), new Color(0.25f, 0.28f, 0.33f), "Window"),
                Primitives.Create(PrimitiveType.Cube, root, new Vector3(0.65f, 0.55f, -0.72f), new Vector3(0.38f, 0.30f, 0.05f), new Color(0.25f, 0.28f, 0.33f), "Window")
            };

            // Pop up with a little overshoot.
            const float grow = 0.6f;
            for (float t = 0f; t < grow && !SkipRequested; t += Time.deltaTime)
            {
                float k = t / grow;
                float overshoot = 1f + 0.18f * Mathf.Sin(k * Mathf.PI);
                root.localScale = Vector3.one * Mathf.SmoothStep(0f, 1f, k) * overshoot;
                yield return null;
            }
            root.localScale = Vector3.one;

            // Windows light up one after another.
            Material lit = GameMaterials.Get(new Color(1f, 0.92f, 0.45f));
            for (int i = 0; i < lamps.Length; i++)
            {
                lamps[i].GetComponent<MeshRenderer>().sharedMaterial = lit;
                if (!SkipRequested) yield return new WaitForSeconds(0.18f);
            }

            // Smoke puffs.
            for (int puff = 0; puff < 4 && !SkipRequested; puff++)
            {
                StartCoroutine(Smoke(root.position + new Vector3(0.7f, 1.9f, 0.25f)));
                yield return new WaitForSeconds(0.25f);
            }
            if (!SkipRequested) yield return new WaitForSeconds(0.5f);
        }

        private IEnumerator Smoke(Vector3 start)
        {
            GameObject puff = Primitives.Create(PrimitiveType.Sphere, transform, start, Vector3.one * 0.25f, new Color(0.88f, 0.9f, 0.94f), "Smoke");
            for (float t = 0f; t < 1.4f; t += Time.deltaTime)
            {
                puff.transform.position = start + new Vector3(0.1f * t, 1.1f * t, 0f);
                puff.transform.localScale = Vector3.one * Mathf.Lerp(0.25f, 0.7f, t / 1.4f) * (1f - t / 1.4f * 0.6f);
                yield return null;
            }
            Destroy(puff);
        }
    }
}
