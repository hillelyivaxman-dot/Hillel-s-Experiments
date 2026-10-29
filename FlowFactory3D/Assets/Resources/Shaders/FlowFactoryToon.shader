// Flat colour with a fixed fake light, so the game looks the same in the Built-in and URP pipelines
// and needs no scene lights, shadows or textures. Lives in Resources so it is always included in builds.
Shader "FlowFactory/ToonColor"
{
    Properties
    {
        _Color ("Color", Color) = (1, 1, 1, 1)
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Color;

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                half shade : TEXCOORD0;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                float3 n = UnityObjectToWorldNormal(v.normal);
                float3 l = normalize(float3(-0.35, 0.85, -0.4));
                o.shade = saturate(dot(n, l)) * 0.55 + 0.45;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                return fixed4(_Color.rgb * i.shade, 1);
            }
            ENDCG
        }
    }
    Fallback "Unlit/Color"
}
