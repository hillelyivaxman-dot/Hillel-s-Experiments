using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
#endif

namespace FlowFactory
{
    /// <summary>
    /// The only place that talks to Unity's input API, so the game works whether the project uses the
    /// new Input System, the legacy Input Manager or both. Mouse (Windows) and touch (Android) behave the same.
    /// </summary>
    public static class InputBridge
    {
        /// <summary>True exactly once per new press/tap, with its screen position. Extra fingers are ignored.</summary>
        public static bool TryGetPress(out Vector2 position)
        {
#if ENABLE_INPUT_SYSTEM
            Pointer pointer = Pointer.current;
            if (pointer != null && pointer.press.wasPressedThisFrame)
            {
                position = pointer.position.ReadValue();
                return true;
            }
            position = Vector2.zero;
            return false;
#elif ENABLE_LEGACY_INPUT_MANAGER
            if (Input.touchCount > 0)
            {
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch touch = Input.GetTouch(i);
                    if (touch.phase == TouchPhase.Began && Input.touchCount == 1)
                    {
                        position = touch.position;
                        return true;
                    }
                }
                position = Vector2.zero;
                return false;
            }
            if (Input.GetMouseButtonDown(0))
            {
                position = Input.mousePosition;
                return true;
            }
            position = Vector2.zero;
            return false;
#else
            position = Vector2.zero;
            return false;
#endif
        }

        /// <summary>The Android back button or the Escape key.</summary>
        public static bool BackPressed()
        {
#if ENABLE_INPUT_SYSTEM
            return Keyboard.current != null && Keyboard.current.escapeKey.wasPressedThisFrame;
#elif ENABLE_LEGACY_INPUT_MANAGER
            return Input.GetKeyDown(KeyCode.Escape);
#else
            return false;
#endif
        }

        /// <summary>Makes sure a single EventSystem with a module matching the active input backend exists.</summary>
        public static void EnsureEventSystem()
        {
            EventSystem system = EventSystem.current;
            if (system == null)
            {
                system = Object.FindFirstObjectByType<EventSystem>();
            }
            if (system == null)
            {
                system = new GameObject("EventSystem").AddComponent<EventSystem>();
            }

#if ENABLE_INPUT_SYSTEM
            var legacy = system.GetComponent<StandaloneInputModule>();
            if (legacy != null)
            {
                Object.Destroy(legacy);
            }
            if (system.GetComponent<InputSystemUIInputModule>() == null)
            {
                var module = system.gameObject.AddComponent<InputSystemUIInputModule>();
                module.AssignDefaultActions();
            }
#else
            if (system.GetComponent<StandaloneInputModule>() == null)
            {
                system.gameObject.AddComponent<StandaloneInputModule>();
            }
#endif
        }
    }
}
