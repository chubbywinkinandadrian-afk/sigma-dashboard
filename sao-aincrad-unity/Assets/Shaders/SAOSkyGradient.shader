// =============================================================================
//  SAO/SkyGradient — flat painted gradient skybox (Built-in RP, Unity 2022.3)
//
//  A three-stop vertical gradient: top sky, horizon glow, below-horizon.
//  Assign a material using this shader in Lighting > Environment > Skybox.
//  Defaults are tuned for the Floor 1 "golden hour" look: violet-blue zenith
//  falling into a warm peach horizon.
// =============================================================================
Shader "SAO/SkyGradient"
{
    Properties
    {
        _TopColor ("Sky Top", Color) = (0.22, 0.26, 0.55, 1)
        _HorizonColor ("Horizon", Color) = (1.0, 0.72, 0.48, 1)
        _BottomColor ("Below Horizon", Color) = (0.35, 0.27, 0.42, 1)
        _HorizonSharpness ("Horizon Sharpness", Range(0.5, 8)) = 2.2
    }

    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" }
        Cull Off
        ZWrite Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _TopColor;
            fixed4 _HorizonColor;
            fixed4 _BottomColor;
            float  _HorizonSharpness;

            struct appdata { float4 vertex : POSITION; };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 dir : TEXCOORD0;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.dir = v.vertex.xyz;   // skybox mesh verts double as view dirs
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float y    = normalize(i.dir).y;
                float up   = pow(saturate(y), 1.0 / _HorizonSharpness);
                float down = pow(saturate(-y), 0.6);

                fixed4 col = lerp(_HorizonColor, _TopColor, up);
                col        = lerp(col, _BottomColor, down);
                return col;
            }
            ENDCG
        }
    }
}
