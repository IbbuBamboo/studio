
import { db } from './firebase';
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  query,
  collectionGroup,
} from 'firebase/firestore';
import type { Participant } from '@/app/room/[roomId]/page';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private peerConnections: { [key: string]: RTCPeerConnection } = {};
  private localStream: MediaStream | null = null;
  private roomId: string;
  private localParticipant: Participant;
  private participants: Participant[] = [];
  private onParticipantsChange: (participants: Participant[]) => void;
  private roomRef: any;
  private unsubscribes: (() => void)[] = [];

  constructor(roomId: string, localParticipant: Participant, onParticipantsChange: (participants: Participant[]) => void) {
    this.roomId = roomId;
    this.localParticipant = localParticipant;
    this.participants = [localParticipant];
    this.onParticipantsChange = onParticipantsChange;
    this.roomRef = doc(db, 'rooms', this.roomId);
    this.updateParticipants();
  }

  private updateParticipants() {
    // Ensure local participant is always first
    const local = this.participants.find(p => p.isLocal);
    const remote = this.participants.filter(p => !p.isLocal);
    this.onParticipantsChange(local ? [local, ...remote] : [...remote]);
  }
  
  public getLocalParticipant(): Participant | undefined {
    return this.participants.find(p => p.isLocal);
  }

  public async joinRoom(stream: MediaStream) {
    this.localStream = stream;
    this.updateLocalParticipant(stream, {
        isMuted: stream.getAudioTracks().every(t => !t.enabled),
        isVideoOff: stream.getVideoTracks().every(t => !t.enabled),
    });

    await setDoc(doc(this.roomRef, 'participants', this.localParticipant.id), {
      name: this.localParticipant.name,
    });
    
    this.listenForParticipants();
  }
  
  private listenForParticipants() {
    const participantsCollection = collection(this.roomRef, 'participants');
    const unsubscribe = onSnapshot(participantsCollection, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const participantId = change.doc.id;
        const participantData = change.doc.data();

        if (participantId === this.localParticipant.id) return;

        if (change.type === 'added') {
          console.log('Participant added:', participantId);
          this.createPeerConnection(participantId, participantData.name);
          // The creator of the room (first one in) will initiate the offers
          const roomSnapshot = await getDoc(this.roomRef);
          if (roomSnapshot.data()?.creator === this.localParticipant.id) {
             await this.createOffer(participantId);
          }
        } else if (change.type === 'removed') {
          console.log('Participant removed:', participantId);
          this.closePeerConnection(participantId);
        }
      });
    });
    this.unsubscribes.push(unsubscribe);
  }
  
  private createPeerConnection(participantId: string, name: string) {
    if (this.peerConnections[participantId]) {
      console.warn('Peer connection already exists for', participantId);
      return;
    }

    const pc = new RTCPeerConnection(servers);
    this.peerConnections[participantId] = pc;

    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    const remoteStream = new MediaStream();
    this.participants = [...this.participants.filter(p => p.id !== participantId), {
      id: participantId,
      name: name,
      stream: remoteStream,
      isMuted: true,
      isVideoOff: true,
      isLocal: false
    }];
    this.updateParticipants();

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };
    
    // Listen for offers for this specific peer connection
    const participantDoc = doc(this.roomRef, 'participants', this.localParticipant.id, 'connections', participantId);
    this.unsubscribes.push(onSnapshot(participantDoc, async (snapshot) => {
      const data = snapshot.data();
      if (data?.offer) {
        console.log('Received offer from', participantId);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await this.createAnswer(participantId);
      }
      if (data?.answer && !pc.currentRemoteDescription) {
        console.log('Received answer from', participantId);
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    }));
    
    const iceCandidatesCollection = collection(participantDoc, 'iceCandidates');
    this.unsubscribes.push(onSnapshot(iceCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        });
    }));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const targetIceCandidates = collection(this.roomRef, 'participants', participantId, 'connections', this.localParticipant.id, 'iceCandidates');
        addDoc(targetIceCandidates, event.candidate.toJSON());
      }
    };

  }
  
  private async createOffer(participantId: string) {
    const pc = this.peerConnections[participantId];
    if (!pc) return;

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = { type: offerDescription.type, sdp: offerDescription.sdp };
    const connectionDoc = doc(this.roomRef, 'participants', participantId, 'connections', this.localParticipant.id);
    await setDoc(connectionDoc, { offer }, { merge: true });
    console.log('Sent offer to', participantId);
  }
  
  private async createAnswer(participantId: string) {
    const pc = this.peerConnections[participantId];
    if (!pc) return;

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
    const connectionDoc = doc(this.roomRef, 'participants', this.localParticipant.id, 'connections', participantId);
    await setDoc(connectionDoc, { answer }, { merge: true });
    console.log('Sent answer to', participantId);
  }

  private closePeerConnection(participantId: string) {
    this.peerConnections[participantId]?.close();
    delete this.peerConnections[participantId];
    this.participants = this.participants.filter(p => p.id !== participantId);
    this.updateParticipants();
  }

  public async hangUp() {
    this.unsubscribes.forEach(unsub => unsub());

    Object.keys(this.peerConnections).forEach(id => this.closePeerConnection(id));

    if (this.localParticipant.id) {
       const participantDoc = doc(this.roomRef, 'participants', this.localParticipant.id);
       const connectionsQuery = query(collection(participantDoc, 'connections'));
       const connectionsSnapshot = await getDocs(connectionsQuery);
       const batch = writeBatch(db);
       connectionsSnapshot.forEach(doc => batch.delete(doc.ref));
       batch.delete(participantDoc);
       await batch.commit();
    }
    
    // Check if room is empty to clean up
    const roomParticipantsSnapshot = await getDocs(collection(this.roomRef, 'participants'));
    if (roomParticipantsSnapshot.empty) {
        // More robust cleanup needed for all subcollections in a real app
        await deleteDoc(this.roomRef);
    }
  }

  public updateLocalParticipant(stream: MediaStream | null, updates: Partial<Participant>) {
    this.localParticipant = { ...this.localParticipant, stream, ...updates };
    this.participants = this.participants.map(p => p.isLocal ? this.localParticipant : p);
    this.updateParticipants();
  }

  public replaceTrack(newTrack: MediaStreamTrack | null) {
    if (!this.localStream) return;
  
    const videoSender = Object.values(this.peerConnections)
      .flatMap(pc => pc.getSenders())
      .find(sender => sender.track?.kind === 'video');
  
    if (videoSender) {
        if (newTrack) {
            videoSender.replaceTrack(newTrack);
        } else {
            // Revert to the original camera track if it exists
            const originalVideoTrack = this.localStream.getVideoTracks()[0];
            if (originalVideoTrack) {
                videoSender.replaceTrack(originalVideoTrack);
            }
        }
    }
  }
}
