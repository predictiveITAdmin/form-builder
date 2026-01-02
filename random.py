import base64
import os

def generate_random_base64(length=32):
    """
    Generate a random base64 encoded string.
    
    Args:
        length: Number of random bytes to generate (default: 32)
    
    Returns:
        A base64 encoded string
    """
    random_bytes = os.urandom(length)
    base64_string = base64.b64encode(random_bytes).decode('utf-8')
    return base64_string

if __name__ == "__main__":
    # Generate a random base64 string with 32 bytes (results in ~43 chars)
    random_string = generate_random_base64()
    print(f"Random Base64 String: {random_string}")
    
    # You can also specify different lengths
    print(f"\n16 bytes: {generate_random_base64(16)}")
    print(f"64 bytes: {generate_random_base64(256)}")


    #Three Things left: Refresh Options, Final Submit..., URL Upload Handler...