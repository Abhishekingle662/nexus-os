```python
import openai
import os

# Set up your OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Function to stream responses from the OpenAI API
def stream_chat_completion(messages):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=messages,
        stream=True
    )
    
    for chunk in response:
        if 'choices' in chunk:
            for choice in chunk['choices']:
                if 'delta' in choice and 'content' in choice['delta']:
                    print(choice['delta']['content'], end='', flush=True)

# Example usage
if __name__ == "__main__":
    messages = [
        {"role": "user", "content": "Hello, how are you?"}
    ]
    
    print("Streaming response:")
    stream_chat_completion(messages)
```

Make sure to set your OpenAI API key in your environment variables as `OPENAI_API_KEY` before running the script. This script will stream the response from the OpenAI API based on the provided messages.