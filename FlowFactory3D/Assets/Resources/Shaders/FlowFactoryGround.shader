// Factory floor: a tiled texture in world space, bright near the board and fading to dark at the edges.
Shader "FlowFactory/Ground"
{
    Properties
    {
        _Inner ("Inner colour", Color) = (0.20, 0.36, 0.42, 1)
        _Outer ("Outer colour", Color) = (0.05, 0.10, 0.14, 1)
        _Radius ("Fade radius", Float) = 9
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

            fixed4 _Inner;
            fixed4 _Outer;
            float _Radius;
            sampler2D _MainTex;

            struct appdata
            {
                float4 vertex : POSITION;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 world : TEXCOORD0;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.world = mul(unity_ObjectToWorld, v.vertex).xz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float fade = saturate(length(i.world) / _Radius);
                fixed3 tint = lerp(_Inner.rgb, _Outer.rgb, fade * fade);
                fixed4 tex = tex2D(_MainTex, i.world * 0.5);
                return fixed4(tint * tex.rgb, 1);
            }
            ENDCG
        }
    }
    Fallback "Unlit/Color"
}
