// Re:Impact — banded cel shader with tinted shadows, rim light and outline.
// Built-in Render Pipeline, no shadows sampled (clean anime look).
Shader "ReImpact/Toon"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        _ShadowTint ("Shadow Tint", Color) = (0.62, 0.55, 0.72, 1)
        _BandSoft ("Band Softness", Range(0.001, 0.2)) = 0.04
        _RimColor ("Rim Color", Color) = (1, 0.92, 0.78, 1)
        _RimPower ("Rim Power", Range(0.5, 8)) = 3.2
        _RimStrength ("Rim Strength", Range(0, 1)) = 0.35
        _OutlineColor ("Outline Color", Color) = (0.1, 0.07, 0.09, 1)
        _OutlineWidth ("Outline Width", Range(0, 0.02)) = 0.004
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }

        // ---- outline (inverted hull)
        Pass
        {
            Name "OUTLINE"
            Cull Front
            ZWrite On

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float4 _OutlineColor;
            float _OutlineWidth;

            struct appdata { float4 vertex : POSITION; float3 normal : NORMAL; };
            struct v2f { float4 pos : SV_POSITION; };

            v2f vert (appdata v)
            {
                v2f o;
                float3 n = normalize(v.normal);
                float4 worldPos = mul(unity_ObjectToWorld, v.vertex);
                float3 worldN = UnityObjectToWorldNormal(n);
                // constant-ish screen width: scale by distance to camera
                float dist = distance(_WorldSpaceCameraPos, worldPos.xyz);
                worldPos.xyz += worldN * _OutlineWidth * (1.0 + dist * 0.5);
                o.pos = mul(UNITY_MATRIX_VP, worldPos);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target { return _OutlineColor; }
            ENDCG
        }

        // ---- cel-banded forward pass
        Pass
        {
            Name "FORWARD"
            Tags { "LightMode"="ForwardBase" }
            Cull Back

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            fixed4 _ShadowTint;
            float _BandSoft;
            fixed4 _RimColor;
            float _RimPower;
            float _RimStrength;

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
                float3 worldN : TEXCOORD1;
                float3 worldPos : TEXCOORD2;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.worldN = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 albedo = tex2D(_MainTex, i.uv) * _Color;
                float3 n = normalize(i.worldN);
                float3 l = normalize(_WorldSpaceLightPos0.xyz);
                float ndl = saturate(dot(n, l));

                // three light bands: shadow / mid / lit
                float b1 = smoothstep(0.22 - _BandSoft, 0.22 + _BandSoft, ndl);
                float b2 = smoothstep(0.62 - _BandSoft, 0.62 + _BandSoft, ndl);
                float lit = 0.45 + 0.3 * b1 + 0.25 * b2;

                float3 shadowed = albedo.rgb * _ShadowTint.rgb;
                float3 col = lerp(shadowed, albedo.rgb, lit) * _LightColor0.rgb;

                // ambient so shadow side never goes black
                col += albedo.rgb * ShadeSH9(half4(n, 1)) * 0.5;

                // rim
                float3 v = normalize(_WorldSpaceCameraPos - i.worldPos);
                float rim = pow(1.0 - saturate(dot(n, v)), _RimPower);
                col += _RimColor.rgb * rim * _RimStrength * (0.4 + 0.6 * b1);

                return fixed4(col, 1);
            }
            ENDCG
        }
    }
    FallBack "Diffuse"
}
