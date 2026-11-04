using UnityEngine;

namespace FlowFactory
{
    /// <summary>Slowly turns a decorative object around its up axis.</summary>
    public sealed class Spinner : MonoBehaviour
    {
        public float DegreesPerSecond = 25f;

        private void Update()
        {
            transform.Rotate(0f, DegreesPerSecond * Time.deltaTime, 0f, Space.Self);
        }
    }
}
