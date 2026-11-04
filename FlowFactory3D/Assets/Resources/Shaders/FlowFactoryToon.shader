// Flat colour (optionally times a texture) with a fixed fake light, so the game looks the same in the
// Built-in and URP pipelines and needs no scene lights, shadows or imported textures.
// Lives in Resources so it is always included in builds.
Shader "FlowFactory/ToonColor"
{
    Properties
    {
        _Color ("Color", Color) = (1, 1, 1, 1)
        _MainTex ("Texture", 2D) = "white" {}
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
            sampler2D _MainTex;
            float4 _MainTex_ST;

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                half shade : TEXCOORD1;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                float3 n = UnityObjectToWorldNormal(v.normal);
                float3 l = normalize(float3(-0.35, 0.85, -0.4));
                float height = mul(unity_ObjectToWorld, v.vertex).y;
                // Light from above, slightly darker near the floor (cheap ambient occlusion).
                o.shade = (saturate(dot(n, l)) * 0.55 + 0.45) * lerp(0.80, 1.0, saturate(height * 1.6 + 0.9));
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 tex = tex2D(_MainTex, i.uv);
                return fixed4(_Color.rgb * tex.rgb * i.shade, 1);
            }
            ENDCG
        }
    }
    Fallback "Unlit/Color"
}
